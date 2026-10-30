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
import { AgentExpressContext, type ExpressContextStatusResponse } from '@salesforce/agents';
import { extractApiError } from '../../../adlUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.express-context.status');

export type AgentExpressContextStatusResult = ExpressContextStatusResponse;

export default class AgentExpressContextStatus extends SfCommand<AgentExpressContextStatusResult> {
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
  };

  public async run(): Promise<AgentExpressContextStatusResult> {
    const { flags } = await this.parse(AgentExpressContextStatus);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: ExpressContextStatusResponse;
    try {
      result = await AgentExpressContext.status(connection, flags['library-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      const cleanMessage = extractApiError(wrapped) ?? wrapped.message;
      throw new SfError(cleanMessage, wrapped.name ?? 'StatusFailed', [], 4, wrapped);
    }

    if (!this.jsonEnabled()) {
      this.styledHeader(`Indexing status: ${result.status}`);
      this.styledObject(result);
    }

    return result;
  }
}
