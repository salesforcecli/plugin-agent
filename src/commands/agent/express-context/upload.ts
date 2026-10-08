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
import { statSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages, SfError } from '@salesforce/core';
import { confirm, select } from '@inquirer/prompts';
import { AgentExpressContext } from '@salesforce/agents';
import { extractApiError } from '../../../adlUtils.js';
import { theme } from '../../../inquirer-theme.js';
import {
  deleteFiles,
  uploadAndWait,
  validateLocalFiles,
  withInterruptFlag,
  type FlowUi,
  type PartialChoice,
} from '../../../expressContextFlow.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.express-context.upload');

export type AgentExpressContextUploadResult = {
  libraryId: string;
  outcome: 'INDEXED' | 'PARTIAL';
  files: Array<{ fileName: string; status?: string }>;
};

export default class AgentExpressContextUpload extends SfCommand<AgentExpressContextUploadResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'library-id': Flags.string({
      summary: messages.getMessage('flags.library-id.summary'),
      char: 'i',
      required: true,
    }),
    file: Flags.file({
      summary: messages.getMessage('flags.file.summary'),
      char: 'f',
      required: true,
      exists: true,
      multiple: true,
    }),
  };

  public async run(): Promise<AgentExpressContextUploadResult> {
    const { flags } = await this.parse(AgentExpressContextUpload);
    const connection = flags['target-org'].getConnection(flags['api-version']);
    const libraryId = flags['library-id'];
    const interactive = !this.jsonEnabled();

    validateLocalFiles(flags.file, (p) => statSync(p).size);

    const ui: FlowUi = {
      log: (m) => this.log(m),
      warn: (m) => this.warn(m),
      choose: interactive
        ? (message, choices): Promise<PartialChoice> => select({ message, choices, theme })
        : undefined,
    };

    return withInterruptFlag(async (isInterrupted) => {
      // SFDrive paths uploaded by this run, so cleanup removes only what we added — never the library.
      const uploadedPaths = new Set<string>();
      try {
        const flow = await uploadAndWait(connection, libraryId, flags.file, ui, {
          isInterrupted,
          onUploaded: (paths) => paths.forEach((p) => uploadedPaths.add(p)),
        });
        if (flow.outcome === 'ABORTED') throw messages.createError('error.notIndexed');

        this.logSuccess(messages.getMessage('success', [flow.files.length, libraryId]));
        return {
          libraryId,
          outcome: flow.outcome,
          files: flow.files.map((f) => ({ fileName: f.fileName, status: f.status })),
        };
      } catch (error) {
        await this.cleanUp(connection, libraryId, uploadedPaths, error, interactive);
        if (error instanceof SfError) throw error;
        const wrapped = SfError.wrap(error);
        throw new SfError(extractApiError(wrapped) ?? wrapped.message, wrapped.name ?? 'UploadFailed', [], 4, wrapped);
      }
    });
  }

  private async cleanUp(
    connection: Connection,
    libraryId: string,
    uploadedPaths: Set<string>,
    cause: unknown,
    interactive: boolean
  ): Promise<void> {
    this.warn(messages.getMessage('cleanup.failed', [SfError.wrap(cause).message]));
    if (uploadedPaths.size === 0) return;
    let files;
    try {
      files = ((await AgentExpressContext.status(connection, libraryId)).files ?? []).filter((f) =>
        uploadedPaths.has(f.filePath)
      );
    } catch (error) {
      this.warn(messages.getMessage('cleanup.lookupFailed', [SfError.wrap(error).message]));
      return;
    }
    if (files.length === 0) return;

    let shouldDelete = true;
    if (interactive) {
      try {
        shouldDelete = await confirm({
          message: messages.getMessage('prompt.cleanup', [files.length, libraryId]),
          default: true,
          theme,
        });
      } catch {
        shouldDelete = true;
      }
    }
    if (!shouldDelete) {
      this.warn(messages.getMessage('cleanup.kept', [files.map((f) => f.fileName).join(', ')]));
      return;
    }
    const { deleted, failed } = await deleteFiles(connection, libraryId, files);
    if (deleted.length) this.log(messages.getMessage('cleanup.deleted', [deleted.join(', ')]));
    if (failed.length) this.warn(messages.getMessage('cleanup.partial', [failed.join('\n')]));
  }
}
