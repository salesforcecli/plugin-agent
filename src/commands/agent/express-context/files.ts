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
import { AgentExpressContext, type ExpressContextFileListResponse } from '@salesforce/agents';
import { extractApiError } from '../../../adlUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.express-context.files');

export type AgentExpressContextFilesResult = ExpressContextFileListResponse;

export default class AgentExpressContextFiles extends SfCommand<AgentExpressContextFilesResult> {
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

  public async run(): Promise<AgentExpressContextFilesResult> {
    const { flags } = await this.parse(AgentExpressContextFiles);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: ExpressContextFileListResponse;
    try {
      result = await AgentExpressContext.listFiles(connection, flags['library-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      const cleanMessage = extractApiError(wrapped) ?? wrapped.message;
      throw new SfError(cleanMessage, wrapped.name ?? 'ListFilesFailed', [], 4, wrapped);
    }

    if (!this.jsonEnabled()) {
      this.table({
        data: result.files,
        columns: [
          { key: 'fileName', name: 'File Name' },
          { key: 'fileId', name: 'File ID' },
          { key: 'fileSize', name: 'Size (bytes)' },
          { key: 'status', name: 'Status' },
        ],
      });
    }

    return result;
  }
}
