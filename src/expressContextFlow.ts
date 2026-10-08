/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Shared upload → poll → resolve flow for the Express Context (AEC) create and upload commands,
 * plus the cleanup helpers used when that flow fails.
 */

import { basename } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Connection, Messages, SfError } from '@salesforce/core';
import { AgentExpressContext, type ExpressContextFileRef } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.express-context.shared');

export const POLL_INTERVAL_MS = 2000;
export const POLL_TIMEOUT_MS = 10 * 60 * 1000;
export const MAX_FILES = 50;
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export type IndexingSnapshot = {
  indexed: ExpressContextFileRef[];
  failed: ExpressContextFileRef[];
  /** Still indexing, or not yet reported by the status endpoint (synthesized with status PENDING). */
  pending: ExpressContextFileRef[];
  timedOut: boolean;
};

export type PartialChoice = 'continue' | 'retry' | 'abort';

/** UI hooks the flow needs; commands pass prompt-backed implementations, tests pass stubs. */
export type FlowUi = {
  log: (message: string) => void;
  warn: (message: string) => void;
  /** Undefined when prompting isn't possible (--json); the flow then aborts on any non-success. */
  choose?: (message: string, choices: Array<{ name: string; value: PartialChoice }>) => Promise<PartialChoice>;
};

export type FlowOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  isInterrupted?: () => boolean;
  /** Called with the SFDrive paths of each successful upload batch, so callers can clean up on failure. */
  onUploaded?: (filePaths: string[]) => void;
};

export type UploadFlowResult =
  | { outcome: 'INDEXED' | 'PARTIAL'; files: ExpressContextFileRef[] }
  | { outcome: 'ABORTED'; files: ExpressContextFileRef[] };

export const isIndexed = (status?: string): boolean => status === 'INDEXED';
export const isFailed = (status?: string): boolean => /FAIL|ERROR/i.test(status ?? '');

const interruptedError = (): SfError => messages.createError('error.interrupted');

/** Poll library status until every tracked file is INDEXED or failed, or until the timeout. */
export const waitForIndexing = async (
  connection: Connection,
  libraryId: string,
  filePaths: string[],
  ui: Pick<FlowUi, 'log'>,
  options: FlowOptions = {}
): Promise<IndexingSnapshot> => {
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + (options.timeoutMs ?? POLL_TIMEOUT_MS);
  let lastSummary = '';

  for (;;) {
    if (options.isInterrupted?.()) throw interruptedError();
    // eslint-disable-next-line no-await-in-loop
    const status = await AgentExpressContext.status(connection, libraryId);
    const byPath = new Map((status.files ?? []).map((f) => [f.filePath, f]));
    const tracked = filePaths.map(
      (filePath) =>
        byPath.get(filePath) ?? { fileId: '', fileName: basename(filePath), filePath, fileSize: 0, status: 'PENDING' }
    );

    const snapshot: IndexingSnapshot = {
      indexed: tracked.filter((f) => isIndexed(f.status)),
      failed: tracked.filter((f) => isFailed(f.status)),
      pending: tracked.filter((f) => !isIndexed(f.status) && !isFailed(f.status)),
      timedOut: false,
    };

    const summary = messages.getMessage('progress', [
      snapshot.indexed.length,
      tracked.length,
      snapshot.failed.length,
      snapshot.pending.length,
    ]);
    if (summary !== lastSummary) {
      ui.log(summary);
      lastSummary = summary;
    }

    if (snapshot.pending.length === 0) return snapshot;
    if (Date.now() + intervalMs > deadline) return { ...snapshot, timedOut: true };
    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs);
  }
};

const names = (files: ExpressContextFileRef[]): string => files.map((f) => f.fileName).join(', ');

/**
 * Upload local files, wait for them to index, and resolve partial success / failure / timeout
 * with the user. Retry is offered once: failed files are deleted and re-uploaded, and files still
 * indexing get another full wait.
 */
export const uploadAndWait = async (
  connection: Connection,
  libraryId: string,
  localPaths: string[],
  ui: FlowUi,
  options: FlowOptions = {}
): Promise<UploadFlowResult> => {
  const localBySfPath = new Map<string, string>();
  let toUpload = localPaths;
  let retried = false;

  for (;;) {
    if (toUpload.length > 0) {
      ui.log(messages.getMessage('uploading', [toUpload.length, libraryId]));
      // eslint-disable-next-line no-await-in-loop
      const uploaded = await AgentExpressContext.upload(connection, libraryId, toUpload);
      uploaded.filePaths.forEach((sfPath, i) => localBySfPath.set(sfPath, toUpload[i]));
      options.onUploaded?.(uploaded.filePaths);
    }

    // eslint-disable-next-line no-await-in-loop
    const snapshot = await waitForIndexing(connection, libraryId, [...localBySfPath.keys()], ui, options);
    const files = [...snapshot.indexed, ...snapshot.failed, ...snapshot.pending];
    if (snapshot.failed.length === 0 && snapshot.pending.length === 0) {
      return { outcome: 'INDEXED', files };
    }

    ui.warn(
      [
        snapshot.timedOut
          ? messages.getMessage('timedOut', [Math.round((options.timeoutMs ?? POLL_TIMEOUT_MS) / 1000)])
          : '',
        messages.getMessage('notAllIndexed', [snapshot.indexed.length, files.length]),
        snapshot.failed.length ? messages.getMessage('failedFiles', [names(snapshot.failed)]) : '',
        snapshot.pending.length ? messages.getMessage('pendingFiles', [names(snapshot.pending)]) : '',
      ]
        .filter(Boolean)
        .join('\n')
    );

    if (!ui.choose) return { outcome: 'ABORTED', files };

    const choices: Array<{ name: string; value: PartialChoice }> = [];
    if (snapshot.indexed.length > 0) {
      choices.push({ name: messages.getMessage('choice.continue', [snapshot.indexed.length]), value: 'continue' });
    }
    if (!retried) choices.push({ name: messages.getMessage('choice.retry'), value: 'retry' });
    choices.push({ name: messages.getMessage('choice.abort'), value: 'abort' });

    // eslint-disable-next-line no-await-in-loop
    const choice = await ui.choose(messages.getMessage('prompt.partial'), choices);
    if (choice === 'continue') return { outcome: 'PARTIAL', files };
    if (choice === 'abort') return { outcome: 'ABORTED', files };

    retried = true;
    // Failed records must go before re-uploading, or the same SFDrive path collides.
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      snapshot.failed
        .filter((f) => f.fileId)
        .map((f) => AgentExpressContext.deleteFile(connection, libraryId, f.fileId))
    );
    toUpload = snapshot.failed.map((f) => localBySfPath.get(f.filePath)).filter((p): p is string => p !== undefined);
    snapshot.failed.forEach((f) => localBySfPath.delete(f.filePath));
  }
};

/**
 * Look up the global (org-level) retriever action GenAiFunctionDefinition that the platform
 * created for a retriever. Its DeveloperName is the local action's key and `source`.
 * Subagent-local copies created on publish (IsLocal = true, PluginId set) also point at the
 * same retriever, so they're excluded. Polls briefly in case provisioning lags the library.
 */
export const findGlobalRetrieverAction = async (
  connection: Connection,
  retrieverId: string,
  options: FlowOptions = {}
): Promise<{ id: string; developerName: string }> => {
  if (!/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(retrieverId)) {
    throw messages.createError('error.invalidRetrieverId', [retrieverId]);
  }
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + (options.timeoutMs ?? POLL_TIMEOUT_MS);
  for (;;) {
    if (options.isInterrupted?.()) throw interruptedError();
    // eslint-disable-next-line no-await-in-loop
    const { records } = await connection.query<{ Id: string; DeveloperName: string; NamespacePrefix: string | null }>(
      'SELECT Id, DeveloperName, NamespacePrefix FROM GenAiFunctionDefinition ' +
        `WHERE InvocationTargetType = 'retriever' AND InvocationTarget = '${retrieverId}' AND IsLocal = false`
    );
    if (records.length > 1) {
      throw messages.createError('error.multipleRetrieverActions', [
        retrieverId,
        records.map((r) => r.DeveloperName).join(', '),
      ]);
    }
    if (records.length === 1) {
      const [{ Id, DeveloperName, NamespacePrefix }] = records;
      return { id: Id, developerName: NamespacePrefix ? `${NamespacePrefix}__${DeveloperName}` : DeveloperName };
    }
    if (Date.now() + intervalMs > deadline) throw messages.createError('error.noRetrieverAction', [retrieverId]);
    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs);
  }
};

/**
 * Delete a library and its global retriever action. Library deletion does NOT cascade to the
 * GenAiFunctionDefinition (verified on an AEC org), so it's removed explicitly. Best-effort:
 * returns what was deleted and what failed rather than throwing midway.
 */
export const deleteLibraryRecords = async (
  connection: Connection,
  libraryId: string,
  retrieverActionId?: string
): Promise<{ deleted: string[]; failed: string[] }> => {
  const deleted: string[] = [];
  const failed: string[] = [];
  try {
    await AgentExpressContext.delete(connection, libraryId);
    deleted.push(`library ${libraryId}`);
  } catch (error) {
    failed.push(`library ${libraryId}: ${SfError.wrap(error).message}`);
  }
  if (retrieverActionId) {
    try {
      await connection.sobject('GenAiFunctionDefinition').destroy(retrieverActionId);
      deleted.push(`retriever action ${retrieverActionId}`);
    } catch (error) {
      failed.push(`retriever action ${retrieverActionId}: ${SfError.wrap(error).message}`);
    }
  }
  return { deleted, failed };
};

/** Delete specific file records from a library (best-effort, same reporting as deleteLibraryRecords). */
export const deleteFiles = async (
  connection: Connection,
  libraryId: string,
  files: ExpressContextFileRef[]
): Promise<{ deleted: string[]; failed: string[] }> => {
  const deleted: string[] = [];
  const failed: string[] = [];
  await Promise.all(
    files
      .filter((f) => f.fileId)
      .map(async (f) => {
        try {
          await AgentExpressContext.deleteFile(connection, libraryId, f.fileId);
          deleted.push(f.fileName);
        } catch (error) {
          failed.push(`${f.fileName}: ${SfError.wrap(error).message}`);
        }
      })
  );
  return { deleted, failed };
};

/**
 * Run `fn` with Ctrl+C turned into a flag the flow polls, so an interrupt during upload/indexing
 * leads to cleanup instead of an abrupt exit. A second Ctrl+C exits immediately.
 * SfCommand's own SIGINT listeners are detached for the duration and restored afterwards.
 */
export const withInterruptFlag = async <T>(fn: (isInterrupted: () => boolean) => Promise<T>): Promise<T> => {
  const previous = process.listeners('SIGINT');
  process.removeAllListeners('SIGINT');
  let interrupted = false;
  const onSigint = (): void => {
    if (interrupted) process.exit(130);
    interrupted = true;
  };
  process.on('SIGINT', onSigint);
  try {
    return await fn(() => interrupted);
  } finally {
    process.removeListener('SIGINT', onSigint);
    previous.forEach((listener) => process.on('SIGINT', listener));
  }
};

/** Validate local files against AEC limits before any org call. */
export const validateLocalFiles = (paths: string[], sizeOf: (path: string) => number): void => {
  if (paths.length > MAX_FILES) throw messages.createError('error.tooManyFiles', [paths.length, MAX_FILES]);
  const tooLarge = paths.filter((p) => sizeOf(p) > MAX_FILE_SIZE);
  if (tooLarge.length) throw messages.createError('error.fileTooLarge', [tooLarge.map((p) => basename(p)).join(', ')]);
};
