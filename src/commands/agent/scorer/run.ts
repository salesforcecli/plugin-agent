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
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { SfCommand, Flags, toHelpSection } from '@salesforce/sf-plugins-core';
import { Messages, EnvironmentVariable } from '@salesforce/core';
import { type SessionView, type ScorerResult, runScorer, loadScorerSpec, sessionViewJsonSchema } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.scorer.run');

// The JSON Schema for the STDM session object, surfaced in the --data flag's help so authors (and agents)
// can hand-construct a valid session. Derived from the SessionView type in @salesforce/agents.
//
// oclif renders flag descriptions through wrap-ansi, which mangles pretty-printed JSON in two ways: it
// tokenizes each line on the regular space (U+0020), and it trimStart()s every wrapped row. Because U+00A0
// (no-break space) is still matched by JS's \s, a plain NBSP indent gets trimmed away on any line with more
// than one whitespace-separated token. So we indent with no-break spaces (never split on) AND prefix each
// indented line with a zero-width space (U+200B) — a non-whitespace char that halts trimStart() before it
// can reach the indentation, so the nesting survives the formatter. Both chars render as no ink / blank
// columns, keeping the schema readable.
const NBSP = '\u00A0';
const ZWSP = '\u200B';
const prettySessionSchema = JSON.stringify(sessionViewJsonSchema(), null, 2).replace(
  /^ +/gm,
  (spaces) => `${ZWSP}${NBSP.repeat(spaces.length)}`
);
const DATA_SCHEMA_HELP = `${messages.getMessage('flags.data.description')}\n\n${prettySessionSchema}`;

export type AgentScorerRunResult = ScorerResult & {
  scorerApiName: string;
};

export default class AgentScorerRun extends SfCommand<AgentScorerRunResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly envVariablesSection = toHelpSection('ENVIRONMENT VARIABLES', EnvironmentVariable.SF_TARGET_ORG);

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
      required: true,
    }),
    // eslint-disable-next-line sf-plugin/flag-min-max-default
    'scorer-version': Flags.integer({
      summary: messages.getMessage('flags.scorer-version.summary'),
      min: 1,
    }),
    data: Flags.string({
      summary: messages.getMessage('flags.data.summary'),
      description: DATA_SCHEMA_HELP,
      exactlyOne: ['data', 'file'],
    }),
    file: Flags.file({
      summary: messages.getMessage('flags.file.summary'),
      exists: true,
      exactlyOne: ['data', 'file'],
    }),
  };

  public async run(): Promise<AgentScorerRunResult> {
    const { flags } = await this.parse(AgentScorerRun);

    const apiName = flags['api-name'];

    // Resolve the scorer from local project metadata by API name — the business logic throws a clear error
    // if no scorer with this API name is authored in the project.
    const directories = this.project!.getUniquePackageDirectories().map((pkgDir) => pkgDir.fullPath);
    const spec = await loadScorerSpec({ apiName, directories, scorerVersion: flags['scorer-version'] });

    const session = this.parseSession(flags.file ? readFileSync(resolve(flags.file), 'utf8') : flags.data!);

    const connection = flags['target-org'].getConnection(flags['api-version']);
    const result = await runScorer(spec, session, connection);

    if (!this.jsonEnabled()) {
      this.styledHeader(`Scorer: ${spec.apiName}`);
      this.log(`Outcome:     ${result.ok ? 'ok' : 'error'}`);
      if (result.output !== undefined) {
        this.log(`Output:      ${Array.isArray(result.output) ? result.output.join(', ') : String(result.output)}`);
      }
      if (result.explanation) this.log(`Explanation: ${result.explanation}`);
      if (result.error) this.log(`Error:       ${result.error}`);
    }

    return { scorerApiName: spec.apiName, ...result };
  }

  // eslint-disable-next-line class-methods-use-this
  private parseSession(raw: string): SessionView {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw messages.createError('error.invalidSessionJson', [(e as Error).message]);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw messages.createError('error.invalidSessionShape', [typeof parsed]);
    }
    return parsed as SessionView;
  }
}
