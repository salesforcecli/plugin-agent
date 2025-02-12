/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages, SfError } from '@salesforce/core';
import { AgentTester, AgentTestCreateLifecycleStages } from '@salesforce/agents';
import { DeployResult } from '@salesforce/source-deploy-retrieve';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { CLIError } from '@oclif/core/errors';
import { makeFlags, promptForFlag, promptForYamlFile } from '../../../flags.js';

// TODO: fix this REGEX for validating Salesforce API names
// for example: LocalInfoAgent passes but not LocalInfoAgentTest
// export const FORTY_CHAR_API_NAME_REGEX =
//   /^(?=.{1,57}$)[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,14}(__[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,39})?$/;

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
      // ensure that it's not empty
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
        return 'Please enter an existing test spec (yaml) file';
      }
      return true;
    },
    required: true,
  },
};

export default class AgentTestCreate extends SfCommand<AgentTestCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly state = 'beta';

  public static readonly flags = {
    ...makeFlags(FLAGGABLE_PROMPTS),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    preview: Flags.boolean({
      summary: messages.getMessage('flags.preview.summary'),
    }),
    'no-prompt': Flags.boolean({
      summary: messages.getMessage('flags.no-prompt.summary'),
      char: 'p',
    }),
  };
  private mso?: MultiStageOutput<{ path: string }>;

  public async run(): Promise<AgentTestCreateResult> {
    const { flags } = await this.parse(AgentTestCreate);

    // throw error if --json is used and not all required flags are provided
    if (this.jsonEnabled()) {
      if (!flags['api-name']) {
        throw messages.createError('error.missingRequiredFlags', ['api-name']);
      }
      if (!flags.spec) {
        throw messages.createError('error.missingRequiredFlags', ['spec']);
      }
    }

    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));

    const apiName = flags['api-name'] ?? (await promptForFlag(FLAGGABLE_PROMPTS['api-name']));
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

    const existingDefinitions = await agentTester.list();
    if (existingDefinitions.some((d) => d.fullName === apiName)) {
      const confirmation = await this.confirm({
        message: messages.getMessage('prompt.confirm', [apiName]),
        defaultAnswer: false,
      });
      if (!confirmation) {
        throw new SfError(`An AiEvaluationDefinition with the name ${apiName} already exists in the org.`);
      }
    }

    const { path, contents } = await agentTester.create(apiName, spec, {
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
