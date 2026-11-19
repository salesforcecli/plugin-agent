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
import { AgentExpressContext } from '@salesforce/agents';
import { extractApiError } from '../../../adlUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.express-context.delete');

export type AgentExpressContextDeleteResult = {
  libraryId: string;
  deleted: boolean;
  /** Developer name of the global retriever action removed with the library, if any. */
  retrieverActionDeleted?: string;
};

export default class AgentExpressContextDelete extends SfCommand<AgentExpressContextDeleteResult> {
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
    'no-prompt': Flags.boolean({
      summary: messages.getMessage('flags.no-prompt.summary'),
      default: false,
    }),
  };

  public async run(): Promise<AgentExpressContextDeleteResult> {
    const { flags } = await this.parse(AgentExpressContextDelete);
    const connection = flags['target-org'].getConnection(flags['api-version']);
    const libraryId = flags['library-id'];

    if (!flags['no-prompt']) {
      const confirmed = await this.confirm({ message: messages.getMessage('confirm', [libraryId]) });
      if (!confirmed) {
        this.log('Aborted.');
        return { libraryId, deleted: false };
      }
    }

    // Library deletion doesn't cascade to the org-level retriever action (GenAiFunctionDefinition), so look
    // it up first and remove it after. A failed lookup only means it can't be cleaned up here.
    let retrieverAction: { id?: string; apiName?: string } | undefined;
    try {
      retrieverAction = (await AgentExpressContext.get(connection, libraryId)).retrieverAction;
    } catch {
      retrieverAction = undefined;
    }

    try {
      await AgentExpressContext.delete(connection, libraryId);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      const cleanMessage = extractApiError(wrapped) ?? wrapped.message;
      throw new SfError(cleanMessage, wrapped.name ?? 'DeleteFailed', [], 4, wrapped);
    }
    this.logSuccess(messages.getMessage('success', [libraryId]));

    let retrieverActionDeleted: string | undefined;
    if (retrieverAction?.id) {
      const name = retrieverAction.apiName ?? retrieverAction.id;
      try {
        await connection.sobject('GenAiFunctionDefinition').destroy(retrieverAction.id);
        retrieverActionDeleted = name;
        this.log(messages.getMessage('retrieverActionDeleted', [name]));
      } catch (error) {
        this.warn(messages.getMessage('retrieverActionNotDeleted', [name, SfError.wrap(error).message]));
      }
    }
    return { libraryId, deleted: true, ...(retrieverActionDeleted && { retrieverActionDeleted }) };
  }
}
