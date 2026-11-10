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
import { AgentExpressContext, type ExpressContextLibrarySummary } from '@salesforce/agents';
import { extractApiError } from '../../../adlUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.express-context.list');

export type AgentExpressContextListResult = { libraries: ExpressContextLibrarySummary[] };

export default class AgentExpressContextList extends SfCommand<AgentExpressContextListResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<AgentExpressContextListResult> {
    const { flags } = await this.parse(AgentExpressContextList);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: { libraries: ExpressContextLibrarySummary[] };
    try {
      result = await AgentExpressContext.list(connection);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      const cleanMessage = extractApiError(wrapped) ?? wrapped.message;
      throw new SfError(messages.getMessage('error.listFailed', [cleanMessage]), 'ListFailed', [], 4, wrapped);
    }

    if (!this.jsonEnabled()) {
      this.table({
        data: result.libraries,
        columns: [
          { key: 'masterLabel', name: 'Name' },
          { key: 'libraryId', name: 'Library ID' },
          { key: 'developerName', name: 'Developer Name' },
          { key: 'status', name: 'Status' },
        ],
      });
    }

    return result;
  }
}
