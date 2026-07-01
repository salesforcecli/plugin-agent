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
import { AgentDataLibrary, type DataLibraryDetail } from '@salesforce/agents';
import { extractApiError } from '../../../adlUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.adl.get');

export type AgentAdlGetResult = DataLibraryDetail;

export default class AgentAdlGet extends SfCommand<AgentAdlGetResult> {
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

  public async run(): Promise<AgentAdlGetResult> {
    const { flags } = await this.parse(AgentAdlGet);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: DataLibraryDetail;
    try {
      result = await AgentDataLibrary.get(connection, flags['library-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      const cleanMessage = extractApiError(wrapped) ?? wrapped.message;
      throw new SfError(messages.getMessage('error.getFailed', [cleanMessage]), 'GetFailed', [], 4, wrapped);
    }

    if (!this.jsonEnabled()) {
      this.log(`Library: ${result.masterLabel} (${result.libraryId})`);
      this.log(`  Source Type: ${result.sourceType}`);
      this.log(`  Status: ${String(result.status)}`);
      if (result.retrieverId) {
        this.log(`  Retriever ID: ${result.retrieverId}`);
        this.log(`  rag_feature_config_id: ARFPC_${result.libraryId}`);
      }
      if (result.retriever) {
        this.log(`  Retriever: ${result.retriever.label} (${result.retriever.id})`);
      }
      if (result.retrieverAction) {
        this.log(
          `  Retriever Action: ${result.retrieverAction.label} (${
            result.retrieverAction.apiName ?? result.retrieverAction.id
          })`
        );
      }
      if (result.description) {
        this.log(`  Description: ${result.description}`);
      }
      const fileCount = result.totalFileCount ?? result.groundingSource?.groundingFileRefs?.length;
      if (fileCount) {
        this.log(`  Files: ${String(fileCount)}`);
      }

      // Warn if files are truncated at 200
      const fileRefs = result.groundingSource?.groundingFileRefs;
      if (fileRefs && result.totalFileCount && result.totalFileCount > fileRefs.length) {
        this.warn(
          `Showing ${fileRefs.length} of ${result.totalFileCount} files. Use \`sf agent adl file list\` for full paginated listing.`
        );
      }
    }
    return result;
  }
}
