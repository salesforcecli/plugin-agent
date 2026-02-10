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

import { join, resolve } from 'node:path';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { generateApiName, Messages, SfError } from '@salesforce/core';
import { AgentJobSpec, ScriptAgent } from '@salesforce/agents';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import YAML from 'yaml';
import { select, input as inquirerInput } from '@inquirer/prompts';
import { theme } from '../../../inquirer-theme.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.authoring-bundle');

export type AgentGenerateAuthoringBundleResult = {
  agentPath: string;
  metaXmlPath: string;
  outputDir: string;
};

export default class AgentGenerateAuthoringBundle extends SfCommand<AgentGenerateAuthoringBundleResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
    }),
    'api-version': Flags.orgApiVersion(),
    spec: Flags.string({
      summary: messages.getMessage('flags.spec.summary'),
      char: 'f',
    }),
    'no-spec': Flags.boolean({
      summary: messages.getMessage('flags.no-spec.summary'),
    }),
    'output-dir': Flags.directory({
      summary: messages.getMessage('flags.output-dir.summary'),
      char: 'd',
    }),
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      char: 'n',
    }),
  };

  public async run(): Promise<AgentGenerateAuthoringBundleResult> {
    const { flags } = await this.parse(AgentGenerateAuthoringBundle);
    const { 'output-dir': outputDir } = flags;

    if (flags.spec && flags['no-spec']) {
      throw new SfError(messages.getMessage('error.specAndNoSpec'));
    }

    // Resolve spec: --no-spec => undefined, --spec <path> => path, missing => wizard prompts
    let spec: string | undefined;
    if (flags['no-spec']) {
      spec = undefined;
    } else if (flags.spec !== undefined) {
      const specPath = resolve(flags.spec);
      if (!existsSync(specPath)) {
        throw new SfError(messages.getMessage('error.no-spec-file'));
      }
      spec = specPath;
    } else {
      // Find spec files in specs/ directory
      const specsDir = join(this.project!.getPath(), 'specs');
      let specFiles: string[] = [];

      if (existsSync(specsDir)) {
        specFiles = readdirSync(specsDir).filter(
          (f) => (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.includes('-testSpec')
        );
      } else {
        this.warn(messages.getMessage('warning.noSpecDir', [specsDir]));
      }

      // Build spec type choices
      const specTypeChoices: Array<{ name: string; value: 'default' | 'fromSpec'; description: string }> = [
        {
          name: messages.getMessage('wizard.specType.option.default.name'),
          value: 'default',
          description: messages.getMessage('wizard.specType.option.default.description'),
        },
      ];

      if (specFiles.length > 0) {
        specTypeChoices.push({
          name: messages.getMessage('wizard.specType.option.fromSpec.name'),
          value: 'fromSpec',
          description: messages.getMessage('wizard.specType.option.fromSpec.description'),
        });
      }

      const specType = await select({
        message: messages.getMessage('wizard.specType.prompt'),
        choices: specTypeChoices,
        theme,
      });

      if (specType === 'fromSpec') {
        const selectedFile = await select({
          message: messages.getMessage('wizard.specFile.prompt'),
          choices: specFiles.map((f) => ({ name: f, value: join(specsDir, f) })),
          theme,
        });
        spec = selectedFile;
      } else {
        spec = undefined;
      }
    }

    // Resolve name: --name flag or prompt
    const name =
      flags['name'] ??
      (await inquirerInput({
        message: messages.getMessage('wizard.name.prompt'),
        validate: (d: string): boolean | string => {
          if (d.length === 0) {
            return messages.getMessage('wizard.name.validation.required');
          }
          if (d.trim().length === 0) {
            return messages.getMessage('wizard.name.validation.empty');
          }
          return true;
        },
        theme,
      }));

    // Resolve API name: --api-name flag or auto-generate from name
    const bundleApiName = flags['api-name'] ?? generateApiName(name);

    const mso = new MultiStageOutput<{ apiName: string }>({
      stages: [
        messages.getMessage('progress.stage.creating'),
        messages.getMessage('progress.stage.generating'),
        messages.getMessage('progress.stage.complete'),
      ],
      title: messages.getMessage('progress.title', [bundleApiName]),
      jsonEnabled: this.jsonEnabled(),
      data: { apiName: bundleApiName },
    });

    try {
      // Get default output directory if not specified
      const defaultOutputDir = join(this.project!.getDefaultPackage().fullPath, 'main', 'default');
      const targetOutputDir = join(outputDir ?? defaultOutputDir, 'aiAuthoringBundles', bundleApiName);

      // Generate file paths
      const agentPath = join(targetOutputDir, `${bundleApiName}.agent`);
      const metaXmlPath = join(targetOutputDir, `${bundleApiName}.bundle-meta.xml`);

      mso.goto(messages.getMessage('progress.stage.creating'));

      const parsedSpec = spec ? (YAML.parse(readFileSync(spec, 'utf8')) as AgentJobSpec) : undefined;

      mso.goto(messages.getMessage('progress.stage.generating'));

      await ScriptAgent.createAuthoringBundle({
        agentSpec: {
          ...parsedSpec,
          name,
          developerName: bundleApiName,
          role: parsedSpec?.role ?? `${name} description`,
        } as AgentJobSpec & { name: string; developerName: string },
        project: this.project!,
        bundleApiName,
      });

      mso.goto(messages.getMessage('progress.stage.complete'));
      mso.stop();

      this.logSuccess(messages.getMessage('success.message', [name]));

      return {
        agentPath,
        metaXmlPath,
        outputDir: targetOutputDir,
      };
    } catch (error) {
      mso.error();
      const err = SfError.wrap(error);
      throw new SfError(messages.getMessage('error.failed-to-create-agent', [err.message]), 'AgentGenerationError');
    }
  }
}
