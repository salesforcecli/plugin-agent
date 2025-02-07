/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages, SfError } from '@salesforce/core';
import { AgentTester, AgentTestCreateLifecycleStages } from '@salesforce/agents';
import { DeployResult } from '@salesforce/source-deploy-retrieve';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { CLIError } from '@oclif/core/errors';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.create');

export type AgentTestCreateResult = {
  path: string;
  contents: string;
};

export default class AgentTestCreate extends SfCommand<AgentTestCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly state = 'beta';

  public static readonly flags = {
    spec: Flags.file({
      summary: messages.getMessage('flags.spec.summary'),
      description: messages.getMessage('flags.spec.description'),
      char: 's',
      required: true,
      exists: true,
    }),
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
    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));

    const lifecycle = Lifecycle.getInstance();

    lifecycle.on(AgentTestCreateLifecycleStages.CreatingLocalMetadata, async () => {
      this.mso = new MultiStageOutput<{ path: string }>({
        jsonEnabled: this.jsonEnabled(),
        stages: Object.values(AgentTestCreateLifecycleStages),
        title: `Creating test for ${flags.spec}`,
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

    const confirmationCallback = flags['no-prompt']
      ? async (): Promise<boolean> => Promise.resolve(true)
      : async (spec: { name: string }): Promise<boolean> =>
          this.confirm({
            message: messages.getMessage('prompt.confirm', [spec.name]),
            defaultAnswer: false,
          });

    const { path, contents } = await agentTester.create(flags.spec, {
      outputDir: join('force-app', 'main', 'default', 'aiEvaluationDefinitions'),
      preview: flags.preview,
      confirmationCallback,
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
