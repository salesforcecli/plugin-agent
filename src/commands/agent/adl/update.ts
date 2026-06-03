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
import { AgentDataLibrary, type DataLibraryDetail, type UpdateLibraryInput } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.adl.update');

export type AgentAdlUpdateResult = DataLibraryDetail;

export default class AgentAdlUpdate extends SfCommand<AgentAdlUpdateResult> {
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
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      char: 'n',
    }),
    description: Flags.string({
      summary: messages.getMessage('flags.description.summary'),
    }),
    'content-fields': Flags.string({
      summary: messages.getMessage('flags.content-fields.summary'),
    }),
    'restrict-to-public-articles': Flags.boolean({
      summary: messages.getMessage('flags.restrict-to-public-articles.summary'),
      allowNo: true,
    }),
    'retriever-id': Flags.string({
      summary: messages.getMessage('flags.retriever-id.summary'),
    }),
  };

  public async run(): Promise<AgentAdlUpdateResult> {
    const { flags } = await this.parse(AgentAdlUpdate);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    const input: UpdateLibraryInput = {};
    if (flags.name) input.masterLabel = flags.name;
    if (flags.description) input.description = flags.description;

    const hasKnowledgeFlags =
      flags['content-fields'] !== undefined || flags['restrict-to-public-articles'] !== undefined;

    if (hasKnowledgeFlags) {
      const detail = await AgentDataLibrary.get(connection, flags['library-id']);
      if (detail.sourceType !== 'KNOWLEDGE') {
        this.warn(
          '--content-fields and --restrict-to-public-articles are only valid for KNOWLEDGE libraries. Ignoring.'
        );
      } else {
        const knowledgeConfig: { contentFields?: string[]; isRestrictToPublicArticle?: boolean } = {};
        if (flags['content-fields'] !== undefined) {
          knowledgeConfig.contentFields = flags['content-fields'].split(',').map((f) => f.trim());
        }
        if (flags['restrict-to-public-articles'] !== undefined) {
          knowledgeConfig.isRestrictToPublicArticle = flags['restrict-to-public-articles'];
        }
        input.groundingSource = {
          sourceType: 'KNOWLEDGE',
          knowledgeConfig,
        };
      }
    }

    if (flags['retriever-id']) {
      if (hasKnowledgeFlags) {
        throw new SfError(
          'Cannot combine --retriever-id with --content-fields or --restrict-to-public-articles.',
          'ConflictingFlags',
          [],
          1
        );
      }
      input.groundingSource = {
        sourceType: 'RETRIEVER',
        retrieverId: flags['retriever-id'],
      };
    }

    let result: DataLibraryDetail;
    try {
      result = await AgentDataLibrary.update(connection, flags['library-id'], input);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(messages.getMessage('error.updateFailed', [wrapped.message]), 'UpdateFailed', [], 4, wrapped);
    }

    this.log(`Updated data library "${result.masterLabel}" (${result.libraryId}).`);
    return result;
  }
}
