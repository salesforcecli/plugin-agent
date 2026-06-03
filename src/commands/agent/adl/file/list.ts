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
import { AgentDataLibrary, type GroundingFileRef } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.adl.file.list');

export type AgentAdlFileListResult = { files: GroundingFileRef[] };

export default class AgentAdlFileList extends SfCommand<AgentAdlFileListResult> {
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

  public async run(): Promise<AgentAdlFileListResult> {
    const { flags } = await this.parse(AgentAdlFileList);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let files: GroundingFileRef[];
    try {
      files = await AgentDataLibrary.listFiles(connection, flags['library-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(messages.getMessage('error.listFailed', [wrapped.message]), 'ListFailed', [], 4, wrapped);
    }

    this.log(`Found ${files.length} file(s).`);
    return { files };
  }
}
