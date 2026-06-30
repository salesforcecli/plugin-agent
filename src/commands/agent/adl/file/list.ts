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
import { AgentDataLibrary, type FileListResponse } from '@salesforce/agents';
import { extractApiError } from '../../../../adlUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.adl.file.list');

export type AgentAdlFileListResult = FileListResponse;

export default class AgentAdlFileList extends SfCommand<AgentAdlFileListResult> {
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
    'page-size': Flags.integer({
      summary: messages.getMessage('flags.page-size.summary'),
      min: 1,
      max: 200,
    }),
    status: Flags.option({
      summary: messages.getMessage('flags.status.summary'),
      options: ['uploaded', 'indexing', 'indexed', 'index_failed', 'deleting', 'delete_failed'] as const,
    })(),
  };

  public async run(): Promise<AgentAdlFileListResult> {
    const { flags } = await this.parse(AgentAdlFileList);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: FileListResponse;
    try {
      result = await AgentDataLibrary.listFiles(connection, flags['library-id'], {
        pageSize: flags['page-size'],
        status: flags.status?.toUpperCase(),
      });
    } catch (error) {
      const wrapped = SfError.wrap(error);
      const cleanMessage = extractApiError(wrapped) ?? wrapped.message;
      throw new SfError(messages.getMessage('error.listFailed', [cleanMessage]), 'ListFailed', [], 4, wrapped);
    }

    if (!this.jsonEnabled() && result.files.length > 0) {
      this.table({
        data: result.files,
        columns: [
          { key: 'fileName', name: 'File Name' },
          { key: 'status', name: 'Status' },
          { key: 'fileSize', name: 'Size (bytes)' },
          { key: 'fileId', name: 'File ID' },
          { key: 'createdDate', name: 'Created' },
        ],
      });
      if (result.nextPageUrl) {
        this.log(`\nShowing ${result.files.length} of ${result.totalSize} files. More results available.`);
      }
    } else if (!this.jsonEnabled()) {
      this.log('No files found.');
    }

    return result;
  }
}
