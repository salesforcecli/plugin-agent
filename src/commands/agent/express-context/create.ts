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
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages, SfError, SfProject } from '@salesforce/core';
import { confirm, input as inquirerInput, select } from '@inquirer/prompts';
import { AgentExpressContext, findAuthoringBundle, type ExpressContextLibrarySummary } from '@salesforce/agents';
import { extractApiError } from '../../../adlUtils.js';
import { promptForAgentFiles } from '../../../flags.js';
import { theme } from '../../../inquirer-theme.js';
import {
  addRetrieverAction,
  hasAction,
  libraryNameForSubagent,
  listSubagents,
} from '../../../expressContextAgentWiring.js';
import {
  deleteLibraryRecords,
  findGlobalRetrieverAction,
  uploadAndWait,
  validateLocalFiles,
  withInterruptFlag,
  type FlowUi,
  type PartialChoice,
} from '../../../expressContextFlow.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.express-context.create');

export type AgentExpressContextCreateResult = {
  libraryId: string;
  developerName: string;
  masterLabel: string;
  retriever: string;
  retrieverAction: string;
  outcome: 'INDEXED' | 'PARTIAL';
  files: Array<{ fileName: string; status?: string }>;
  agentAction: {
    authoringBundle: string;
    subagent: string;
    actionName: string;
    label: string;
    filePath: string;
  };
};

const required = (d: string): boolean | string => d.trim().length > 0 || messages.getMessage('error.emptyValue');

/** Matches the plain developer name or the platform's 8-hex-char hash-suffixed variant. */
const sameLibrary = (lib: ExpressContextLibrarySummary, masterLabel: string, developerName: string): boolean =>
  lib.masterLabel?.toLowerCase() === masterLabel.toLowerCase() ||
  new RegExp(`^${developerName}(_[0-9a-f]{8})?$`, 'i').test(lib.developerName ?? '');

const wrapApiError = (error: unknown, name: string): SfError => {
  const wrapped = SfError.wrap(error);
  return new SfError(extractApiError(wrapped) ?? wrapped.message, wrapped.name ?? name, [], 4, wrapped);
};

export default class AgentExpressContextCreate extends SfCommand<AgentExpressContextCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    file: Flags.file({
      summary: messages.getMessage('flags.file.summary'),
      char: 'f',
      required: true,
      exists: true,
      multiple: true,
    }),
    'authoring-bundle': Flags.string({
      summary: messages.getMessage('flags.authoring-bundle.summary'),
      char: 'b',
    }),
    subagent: Flags.string({
      summary: messages.getMessage('flags.subagent.summary'),
      char: 's',
    }),
    'action-label': Flags.string({
      summary: messages.getMessage('flags.action-label.summary'),
    }),
    'action-description': Flags.string({
      summary: messages.getMessage('flags.action-description.summary'),
    }),
  };

  public async run(): Promise<AgentExpressContextCreateResult> {
    const { flags } = await this.parse(AgentExpressContextCreate);
    const interactive = !this.jsonEnabled();

    // ── Phase A: gather and validate everything locally. No org calls until the user confirms. ──
    if (!interactive) {
      const missing = (['authoring-bundle', 'subagent', 'action-label', 'action-description'] as const).filter(
        (f) => !flags[f]
      );
      if (missing.length) throw messages.createError('error.missingFlags', [missing.join(', ')]);
    }

    validateLocalFiles(flags.file, (p) => statSync(p).size);

    let project: SfProject;
    try {
      project = this.project ?? (await SfProject.resolve());
    } catch {
      throw messages.createError('error.noProject');
    }

    const authoringBundle =
      flags['authoring-bundle'] ??
      (await promptForAgentFiles(project, {
        message: messages.getMessage('flags.authoring-bundle.summary'),
        promptMessage: messages.getMessage('prompt.authoringBundle'),
        validate: () => true,
      }));
    const bundleDir = findAuthoringBundle(
      project.getPackageDirectories().map((dir) => dir.fullPath),
      authoringBundle
    );
    if (!bundleDir) throw messages.createError('error.bundleNotFound', [authoringBundle]);
    const agentFile = join(bundleDir, `${authoringBundle}.agent`);

    const subagents = listSubagents(await readFile(agentFile, 'utf8'));
    if (subagents.length === 0) throw messages.createError('error.noSubagents', [authoringBundle]);
    if (flags.subagent && !subagents.some((s) => s.name === flags.subagent)) {
      throw messages.createError('error.subagentNotFound', [
        flags.subagent,
        authoringBundle,
        subagents.map((s) => s.name).join(', '),
      ]);
    }
    const subagentName =
      flags.subagent ??
      (await select<string>({
        message: messages.getMessage('prompt.subagent'),
        choices: subagents.map((s) => ({
          name: s.label === s.name ? s.name : `${s.label} (${s.name})`,
          value: s.name,
        })),
        theme,
      }));
    const subagent = subagents.find((s) => s.name === subagentName)!;
    const { masterLabel, developerName } = libraryNameForSubagent(subagent.label);

    // The platform names the global action <developerName>_RetrieverAction; catch the obvious
    // duplicate now. The real name is re-checked when the file is edited.
    if (hasAction(await readFile(agentFile, 'utf8'), subagentName, `${developerName}_RetrieverAction`)) {
      throw messages.createError('error.actionExists', [subagentName, `${developerName}_RetrieverAction`]);
    }

    const label =
      flags['action-label'] ??
      (await inquirerInput({ message: messages.getMessage('prompt.actionLabel'), validate: required, theme }));
    const description =
      flags['action-description'] ??
      (await inquirerInput({ message: messages.getMessage('prompt.actionDescription'), validate: required, theme }));

    if (interactive) {
      this.log(
        messages.getMessage('summary.plan', [
          masterLabel,
          developerName,
          flags.file.length,
          authoringBundle,
          subagent.label,
          subagentName,
          label.trim(),
        ])
      );
      if (!(await confirm({ message: messages.getMessage('prompt.proceed'), default: true, theme }))) {
        throw messages.createError('error.cancelled');
      }
    }

    // ── Phase B: org work. Anything that fails after the library exists triggers cleanup. ──
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let existing: ExpressContextLibrarySummary[];
    try {
      existing = (await AgentExpressContext.list(connection)).libraries;
    } catch (error) {
      throw wrapApiError(error, 'ListFailed');
    }
    const clash = existing.find((lib) => sameLibrary(lib, masterLabel, developerName));
    if (clash) throw messages.createError('error.libraryExists', [masterLabel, clash.libraryId], [clash.libraryId]);

    const ui: FlowUi = {
      log: (m) => this.log(m),
      warn: (m) => this.warn(m),
      choose: interactive
        ? (message, choices): Promise<PartialChoice> => select({ message, choices, theme })
        : undefined,
    };

    return withInterruptFlag(async (isInterrupted) => {
      let library: ExpressContextLibrarySummary;
      try {
        library = await AgentExpressContext.create(connection, {
          masterLabel,
          developerName,
          description: description.trim(),
        });
      } catch (error) {
        throw wrapApiError(error, 'CreateFailed');
      }
      this.log(messages.getMessage('created', [library.masterLabel, library.libraryId]));

      let retrieverActionId = library.retrieverAction?.id;
      try {
        const retriever = library.retriever ?? (await AgentExpressContext.get(connection, library.libraryId)).retriever;
        if (!retriever?.id || !retriever.apiName) throw messages.createError('error.noRetriever', [library.libraryId]);

        const globalAction = await findGlobalRetrieverAction(connection, retriever.id, { isInterrupted });
        retrieverActionId = globalAction.id;

        const flow = await uploadAndWait(connection, library.libraryId, flags.file, ui, { isInterrupted });
        if (flow.outcome === 'ABORTED') throw messages.createError('error.notIndexed');

        // Re-read: the file may have been edited while files were indexing.
        const updated = addRetrieverAction(await readFile(agentFile, 'utf8'), {
          subagent: subagentName,
          actionName: globalAction.developerName,
          label: label.trim(),
          description: description.trim(),
          retrieverApiName: retriever.apiName,
        });
        await writeFile(agentFile, updated, 'utf8');

        this.logSuccess(
          messages.getMessage('success', [globalAction.developerName, subagentName, relative(process.cwd(), agentFile)])
        );
        this.log(messages.getMessage('nextSteps', [authoringBundle]));

        return {
          libraryId: library.libraryId,
          developerName: library.developerName,
          masterLabel: library.masterLabel,
          retriever: retriever.apiName,
          retrieverAction: globalAction.developerName,
          outcome: flow.outcome,
          files: flow.files.map((f) => ({ fileName: f.fileName, status: f.status })),
          agentAction: {
            authoringBundle,
            subagent: subagentName,
            actionName: globalAction.developerName,
            label: label.trim(),
            filePath: agentFile,
          },
        };
      } catch (error) {
        await this.cleanUp(connection, library, retrieverActionId, error, interactive);
        throw error instanceof SfError ? error : wrapApiError(error, 'CreateFailed');
      }
    });
  }

  private async cleanUp(
    connection: Connection,
    library: ExpressContextLibrarySummary,
    retrieverActionId: string | undefined,
    cause: unknown,
    interactive: boolean
  ): Promise<void> {
    this.warn(messages.getMessage('cleanup.failed', [SfError.wrap(cause).message]));
    let shouldDelete = true;
    if (interactive) {
      try {
        shouldDelete = await confirm({
          message: messages.getMessage('prompt.cleanup', [library.masterLabel, library.libraryId]),
          default: true,
          theme,
        });
      } catch {
        // Prompt itself interrupted (Ctrl+C): still clean up rather than leave a half-made library.
        shouldDelete = true;
      }
    }
    if (!shouldDelete) {
      this.warn(messages.getMessage('cleanup.kept', [library.libraryId, retrieverActionId ?? 'unknown']));
      return;
    }
    const { deleted, failed } = await deleteLibraryRecords(connection, library.libraryId, retrieverActionId);
    if (deleted.length) this.log(messages.getMessage('cleanup.deleted', [deleted.join(', ')]));
    if (failed.length) this.warn(messages.getMessage('cleanup.partial', [failed.join('\n')]));
  }
}
