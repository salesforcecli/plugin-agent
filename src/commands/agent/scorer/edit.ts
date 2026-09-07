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
import { join, resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import {
  setVersionStatusInScorerXml,
  setVersionAssociationActiveInScorerXml,
  SCORER_VERSION_STATUSES,
  type ScorerVersionStatus,
} from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.scorer.edit');

export type AgentScorerEditResult = {
  path: string;
  apiName: string;
  contents: string;
};

/**
 * Edit one version of an already-authored scorer, in place: change its status (`--status`) and/or turn its
 * agent association on or off (`--activate` / `--deactivate`). Editing never authors content — a version's
 * rubric is immutable once it exists; status and activation are the only fields that change. To add a new
 * version (a refined rubric) use `sf agent scorer create --new-version`.
 *
 * This is a purely local metadata operation (it edits the scorer's XML on disk), so it needs no org connection;
 * deploy the definition afterward for the org to reflect the change.
 */
export default class AgentScorerEdit extends SfCommand<AgentScorerEditResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
      required: true,
    }),
    // eslint-disable-next-line sf-plugin/flag-min-max-default
    version: Flags.integer({
      summary: messages.getMessage('flags.version.summary'),
      required: true,
      min: 1,
    }),
    status: Flags.string({
      summary: messages.getMessage('flags.status.summary'),
      options: SCORER_VERSION_STATUSES,
    }),
    activate: Flags.boolean({
      summary: messages.getMessage('flags.activate.summary'),
      exclusive: ['deactivate'],
    }),
    deactivate: Flags.boolean({
      summary: messages.getMessage('flags.deactivate.summary'),
      exclusive: ['activate'],
    }),
    'output-dir': Flags.directory({
      summary: messages.getMessage('flags.output-dir.summary'),
      default: join('force-app', 'main', 'default'),
    }),
    preview: Flags.boolean({
      summary: messages.getMessage('flags.preview.summary'),
    }),
  };

  public async run(): Promise<AgentScorerEditResult> {
    const { flags } = await this.parse(AgentScorerEdit);
    const apiName = flags['api-name'];
    const version = flags.version;
    const outputDir = resolve(flags['output-dir']);
    const status = flags.status as ScorerVersionStatus | undefined;
    // --activate → true, --deactivate → false, neither → leave the association untouched.
    const activate = flags.activate ? true : flags.deactivate ? false : undefined;

    if (!status && activate === undefined) {
      throw messages.createError('error.noChange');
    }

    const scorerPath = join(outputDir, 'aiAgentScorerDefinitions', `${apiName}.aiAgentScorerDefinition-meta.xml`);

    let existingXml: string;
    try {
      existingXml = await readFile(scorerPath, 'utf8');
    } catch {
      throw messages.createError('error.scorerNotFound', [apiName, scorerPath]);
    }

    // Apply every requested change in memory against a single load, then write once, so a combined status +
    // activation edit (and its --preview) reflects both changes together.
    let contents = existingXml;
    const changes: string[] = [];
    if (status) {
      contents = setVersionStatusInScorerXml(contents, apiName, version, status);
      changes.push(`status → ${status}`);
    }
    if (activate !== undefined) {
      contents = setVersionAssociationActiveInScorerXml(contents, apiName, version, activate);
      changes.push(activate ? 'agent association activated' : 'agent association deactivated');
    }

    if (flags.preview) {
      this.log(`\n--- ${apiName} v${version} (${changes.join(', ')}) — preview ---\n`);
      this.log(contents);
      return { path: scorerPath, apiName, contents };
    }

    await writeFile(scorerPath, contents);
    this.log(`Updated ${apiName} v${version} (${changes.join(', ')}): ${scorerPath}`);
    this.log('Deploy the scorer definition for the org to reflect this change.');

    return { path: scorerPath, apiName, contents };
  }
}
