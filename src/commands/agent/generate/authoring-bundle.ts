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
import YAML from 'yaml';
import { select, input as inquirerInput } from '@inquirer/prompts';
import { theme } from '../../../inquirer-theme.js';
import yesNoOrCancel from '../../../yes-no-cancel.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.authoring-bundle');

export type AgentGenerateAuthoringBundleResult = {
  agentPath: string;
  metaXmlPath: string;
  outputDir: string;
};

async function resolveUniqueBundle(
  baseOutputDir: string,
  forceOverwrite: boolean,
  flagName?: string,
  flagApiName?: string
): Promise<{ name: string; apiName: string } | undefined> {
  const name =
    flagName ??
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

  let apiName = flagApiName ?? '';
  if (!apiName) {
    apiName = generateApiName(name);
    const promptedValue = await inquirerInput({
      message: messages.getMessage('flags.api-name.prompt'),
      validate: (d: string): boolean | string => {
        if (d.length === 0) {
          return true;
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
      default: apiName,
      theme,
    });
    if (promptedValue?.length) {
      apiName = promptedValue;
    }
  }

  if (forceOverwrite) {
    return { name, apiName };
  }

  const bundleDir = join(baseOutputDir, 'aiAuthoringBundles', apiName);
  if (!existsSync(bundleDir)) {
    return { name, apiName };
  }

  const confirmation = await yesNoOrCancel({
    message: messages.getMessage('prompt.overwrite', [apiName]),
    default: false,
  });

  if (confirmation === 'cancel') {
    return undefined;
  }
  if (confirmation) {
    return { name, apiName };
  }

  // User chose "no" — restart from the beginning without flag values
  return resolveUniqueBundle(baseOutputDir, false);
}

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
    'force-overwrite': Flags.boolean({
      summary: messages.getMessage('flags.force-overwrite.summary'),
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

    const defaultOutputDir = join(this.project!.getDefaultPackage().fullPath, 'main', 'default');
    const baseOutputDir = outputDir ?? defaultOutputDir;

    const resolved = await resolveUniqueBundle(
      baseOutputDir,
      flags['force-overwrite'] ?? false,
      flags['name'],
      flags['api-name']
    );

    if (!resolved) {
      this.log(messages.getMessage('info.cancel'));
      return { agentPath: '', metaXmlPath: '', outputDir: '' };
    }

    const { name, apiName: bundleApiName } = resolved;

    try {
      const targetOutputDir = join(baseOutputDir, 'aiAuthoringBundles', bundleApiName);

      // Generate file paths
      const agentPath = join(targetOutputDir, `${bundleApiName}.agent`);
      const metaXmlPath = join(targetOutputDir, `${bundleApiName}.bundle-meta.xml`);

      this.spinner.start(messages.getMessage('progress.title', [bundleApiName]));

      const parsedSpec = spec ? (YAML.parse(readFileSync(spec, 'utf8')) as AgentJobSpec) : undefined;

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

      this.spinner.stop();

      this.logSuccess(messages.getMessage('success.message', [name]));

      return {
        agentPath,
        metaXmlPath,
        outputDir: targetOutputDir,
      };
    } catch (error) {
      this.spinner.stop('failed');
      const err = SfError.wrap(error);
      throw new SfError(messages.getMessage('error.failed-to-create-agent', [err.message]), 'AgentGenerationError');
    }
  }
}
