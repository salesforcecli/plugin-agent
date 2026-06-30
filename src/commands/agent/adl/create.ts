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
import {
  AgentDataLibrary,
  type DataLibraryDetail,
  type GroundingSource,
  type SourceType,
  type CreateLibraryInput,
} from '@salesforce/agents';
import { extractApiError } from '../../../adlUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.adl.create');

export type AgentAdlCreateResult = DataLibraryDetail;

export default class AgentAdlCreate extends SfCommand<AgentAdlCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      char: 'n',
      required: true,
    }),
    'developer-name': Flags.string({
      summary: messages.getMessage('flags.developer-name.summary'),
      required: true,
    }),
    'source-type': Flags.option({
      summary: messages.getMessage('flags.source-type.summary'),
      options: ['sfdrive', 'knowledge', 'retriever'] as const,
      required: true,
    })(),
    description: Flags.string({
      summary: messages.getMessage('flags.description.summary'),
    }),
    'index-mode': Flags.option({
      summary: messages.getMessage('flags.index-mode.summary'),
      options: ['basic', 'enhanced'] as const,
    })(),
    'retriever-id': Flags.string({
      summary: messages.getMessage('flags.retriever-id.summary'),
    }),
    'primary-index-field1': Flags.string({
      summary: messages.getMessage('flags.primary-index-field1.summary'),
    }),
    'primary-index-field2': Flags.string({
      summary: messages.getMessage('flags.primary-index-field2.summary'),
    }),
    'content-fields': Flags.string({
      summary: messages.getMessage('flags.content-fields.summary'),
    }),
    'data-category-ids': Flags.string({
      summary: messages.getMessage('flags.data-category-ids.summary'),
    }),
    'data-category-names': Flags.string({
      summary: messages.getMessage('flags.data-category-names.summary'),
    }),
  };

  public async run(): Promise<AgentAdlCreateResult> {
    const { flags } = await this.parse(AgentAdlCreate);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    const sourceType = flags['source-type'].toUpperCase() as SourceType;

    if (sourceType === 'KNOWLEDGE' && (!flags['primary-index-field1'] || !flags['primary-index-field2'])) {
      throw new SfError(messages.getMessage('error.missingKnowledgeFields'), 'MissingKnowledgeFields', [], 1);
    }

    if (sourceType === 'RETRIEVER' && !flags['retriever-id']) {
      throw new SfError(messages.getMessage('error.missingRetrieverId'), 'MissingRetrieverId', [], 1);
    }

    const groundingSource: GroundingSource = { sourceType };

    if (sourceType === 'SFDRIVE' && flags['index-mode']) {
      groundingSource.indexMode = flags['index-mode'].toUpperCase();
    }

    if (sourceType === 'RETRIEVER') {
      groundingSource.retrieverId = flags['retriever-id'];
    }

    if (sourceType === 'KNOWLEDGE') {
      groundingSource.knowledgeConfig = {
        primaryIndexField1: flags['primary-index-field1']!,
        primaryIndexField2: flags['primary-index-field2']!,
      };

      if (flags['content-fields']) {
        groundingSource.knowledgeConfig.contentFields = flags['content-fields']
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
      }

      if (flags['data-category-ids']) {
        groundingSource.knowledgeConfig.dataCategoryIds = flags['data-category-ids']
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
      }

      if (flags['data-category-names']) {
        groundingSource.knowledgeConfig.dataCategoryNames = flags['data-category-names']
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
      }
    }

    const input: CreateLibraryInput = {
      masterLabel: flags.name,
      developerName: flags['developer-name'],
      groundingSource,
    };

    if (flags.description) {
      input.description = flags.description;
    }

    let result: DataLibraryDetail;
    try {
      result = await AgentDataLibrary.create(connection, input);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      const cleanMessage = extractApiError(wrapped) ?? wrapped.message;
      throw new SfError(messages.getMessage('error.createFailed', [cleanMessage]), 'CreateFailed', [], 4, wrapped);
    }

    this.log(`Created data library "${result.masterLabel}" (${result.libraryId}).`);
    return result;
  }
}
