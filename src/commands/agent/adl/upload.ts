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
import { AgentDataLibrary, type UploadResult } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.adl.upload');

export type AgentAdlUploadResult = UploadResult;

export default class AgentAdlUpload extends SfCommand<AgentAdlUploadResult> {
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
    file: Flags.file({
      summary: messages.getMessage('flags.file.summary'),
      char: 'f',
      required: true,
      exists: true,
    }),
    // eslint-disable-next-line sf-plugin/flag-min-max-default
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      min: 1,
      summary: messages.getMessage('flags.wait.summary'),
    }),
  };

  public async run(): Promise<AgentAdlUploadResult> {
    const { flags } = await this.parse(AgentAdlUpload);
    const connection = flags['target-org'].getConnection(flags['api-version']);
    const libraryId = flags['library-id'];
    const filePath = flags.file;

    let result: UploadResult;
    try {
      result = await AgentDataLibrary.upload(connection, libraryId, filePath, {
        waitMinutes: flags.wait?.minutes,
      });
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(wrapped.message, wrapped.name ?? 'UploadFailed', [], 4, wrapped);
    }

    if (result.status === 'READY') {
      this.log(`Library ready. retrieverId: ${String(result.retrieverId)}`);
    } else {
      this.log('Indexing triggered. Use "sf agent adl get" to check readiness.');
    }

    return result;
  }
}
