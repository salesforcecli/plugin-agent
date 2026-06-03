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
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { AgentDataLibrary, type IndexingStatusResponse } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.adl.status');

export type AgentAdlStatusResult = IndexingStatusResponse;

export default class AgentAdlStatus extends SfCommand<AgentAdlStatusResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;
  public static readonly state = 'preview';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'library-id': Flags.string({
      summary: messages.getMessage('flags.library-id.summary'),
      char: 'i',
      required: true,
    }),
  };

  public async run(): Promise<AgentAdlStatusResult> {
    const { flags } = await this.parse(AgentAdlStatus);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: IndexingStatusResponse;
    try {
      result = await AgentDataLibrary.status(connection, flags['library-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(messages.getMessage('error.statusFailed', [wrapped.message]), 'StatusFailed', [], 4, wrapped);
    }

    const { indexingStatus } = result;
    this.log(`Library ${indexingStatus.libraryId}: ${indexingStatus.status}`);
    if (indexingStatus.stageDetails) {
      for (const stage of indexingStatus.stageDetails) {
        this.log(`  ${stage.name}: ${stage.status}${stage.error ? ` (${stage.error})` : ''}`);
      }
    }
    return result;
  }
}
