/*
 * Copyright 2025, Salesforce, Inc.
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
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Connection, Lifecycle, Messages, SfError } from '@salesforce/core';
import { AgentTest, AgentTestCreateLifecycleStages } from '@salesforce/agents';
import { DeployResult } from '@salesforce/source-deploy-retrieve';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { CLIError } from '@oclif/core/errors';
import { makeFlags, promptForFlag, promptForYamlFile } from '../../../flags.js';
import yesNoOrCancel from '../../../yes-no-cancel.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.create');

export type AgentTestCreateResult = {
  path: string;
  contents: string;
};

const FLAGGABLE_PROMPTS = {
  'api-name': {
    message: messages.getMessage('flags.api-name.summary'),
    validate: (d: string): boolean | string => {
      if (!d.length) {
        return 'API name cannot be empty';
      }

      if (d.length > 80) {
        return 'API name cannot be over 80 characters.';
      }
      const regex = /^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]+$/;
      if (!regex.test(d)) {
        return 'Invalid API name.';
      }
      return true;
    },
    required: true,
  },
  spec: {
    message: messages.getMessage('flags.spec.summary'),
    validate: (d: string): boolean | string => {
      const specPath = resolve(d);
      if (!existsSync(specPath)) {
        return 'Enter an existing test spec YAML file';
      }
      return true;
    },
    required: true,
  },
};

async function promptUntilUniqueName(connection: Connection, name?: string | undefined): Promise<string | undefined> {
  const apiName = name ?? (await promptForFlag(FLAGGABLE_PROMPTS['api-name']));
  const existingDefinitions = await AgentTest.list(connection);
  if (existingDefinitions.some((d) => d.fullName === apiName)) {
    const confirmation = await yesNoOrCancel({
      message: messages.getMessage('prompt.confirm', [apiName]),
      default: false,
    });
    if (confirmation === 'cancel') {
      return;
    }

    if (!confirmation) {
      return promptUntilUniqueName(connection);
    }
  }
  return apiName;
}

export default class AgentTestCreate extends SfCommand<AgentTestCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...makeFlags(FLAGGABLE_PROMPTS),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    preview: Flags.boolean({
      summary: messages.getMessage('flags.preview.summary'),
    }),
    'force-overwrite': Flags.boolean({
      summary: messages.getMessage('flags.force-overwrite.summary'),
    }),
  };
  private mso?: MultiStageOutput<{ path: string }>;

  public async run(): Promise<AgentTestCreateResult> {
    const { flags } = await this.parse(AgentTestCreate);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    // throw error if --json is used and not all required flags are provided
    if (this.jsonEnabled()) {
      if (!flags['api-name']) {
        throw messages.createError('error.missingRequiredFlags', ['api-name']);
      }
      if (!flags.spec) {
        throw messages.createError('error.missingRequiredFlags', ['spec']);
      }
    }

    if (flags['force-overwrite'] && !flags['api-name']) {
      throw messages.createError('error.missingRequiredFlags', ['api-name']);
    }

    const apiName = flags['force-overwrite']
      ? flags['api-name']
      : await promptUntilUniqueName(connection, flags['api-name']);
    if (!apiName) {
      this.log(messages.getMessage('info.cancel'));
      return {
        path: '',
        contents: '',
      };
    }

    const spec = flags.spec ?? (await promptForYamlFile(FLAGGABLE_PROMPTS.spec));
    const lifecycle = Lifecycle.getInstance();

    lifecycle.on(AgentTestCreateLifecycleStages.CreatingLocalMetadata, async () => {
      this.mso = new MultiStageOutput<{ path: string }>({
        jsonEnabled: this.jsonEnabled(),
        stages: Object.values(AgentTestCreateLifecycleStages),
        title: `Creating test for ${spec}`,
      });
      this.mso?.skipTo(AgentTestCreateLifecycleStages.CreatingLocalMetadata);
      return Promise.resolve();
    });

    lifecycle.on(AgentTestCreateLifecycleStages.DeployingMetadata, async () =>
      Promise.resolve(this.mso?.skipTo(AgentTestCreateLifecycleStages.DeployingMetadata))
    );

    lifecycle.on(AgentTestCreateLifecycleStages.Waiting, async () =>
      Promise.resolve(this.mso?.skipTo(AgentTestCreateLifecycleStages.Waiting))
    );

    lifecycle.on(AgentTestCreateLifecycleStages.Done, async (result: DeployResult) => {
      if (result.response.success) {
        this.mso?.skipTo(AgentTestCreateLifecycleStages.Done);
        this.mso?.stop();
      } else {
        this.mso?.error();
        this.mso?.stop();
      }

      return Promise.resolve();
    });

    const { path, contents } = await AgentTest.create(connection, apiName, spec, {
      outputDir: join('force-app', 'main', 'default', 'aiEvaluationDefinitions'),
      preview: flags.preview,
    });

    if (flags.preview) {
      this.mso?.skipTo(AgentTestCreateLifecycleStages.Done);
      this.mso?.stop();
      this.log(messages.getMessage('info.preview-success', [path]));
    } else {
      this.log(
        messages.getMessage('info.success', [path, flags['target-org'].getUsername() ?? flags['target-org'].getOrgId()])
      );
    }

    return {
      path,
      contents,
    };
  }

  protected catch(error: Error | SfError | CLIError): Promise<never> {
    this.mso?.error();
    return super.catch(error);
  }
}
