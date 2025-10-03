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
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { generateApiName, Messages, SfError } from '@salesforce/core';
import { Agent, AgentJobSpec } from '@salesforce/agents';
import YAML from 'yaml';
import { input as inquirerInput } from '@inquirer/prompts';
import { theme } from '../../../inquirer-theme.js';
import { FlaggablePrompt, promptForFlag, promptForYamlFile } from '../../../flags.js';

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
    spec: Flags.file({
      summary: messages.getMessage('flags.spec.summary'),
      char: 'f',
      exists: true,
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

  private static readonly FLAGGABLE_PROMPTS = {
    name: {
      message: messages.getMessage('flags.name.summary'),
      validate: (d: string): boolean | string =>
        d.trim().length > 0 || 'Name cannot be empty or contain only whitespace',
      required: true,
    },
    'api-name': {
      message: messages.getMessage('flags.api-name.summary'),
      promptMessage: messages.getMessage('flags.api-name.prompt'),
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
    },
    spec: {
      message: messages.getMessage('flags.spec.summary'),
      validate: (d: string): boolean | string => {
        const specPath = resolve(d);
        if (!existsSync(specPath)) {
          return 'Please enter an existing agent spec (yaml) file';
        }
        return true;
      },
      required: true,
    },
  } satisfies Record<string, FlaggablePrompt>;

  public async run(): Promise<AgentGenerateAuthoringBundleResult> {
    const { flags } = await this.parse(AgentGenerateAuthoringBundle);
    const { 'output-dir': outputDir, 'target-org': targetOrg } = flags;

    // If we don't have a spec yet, prompt for it
    const spec = flags.spec ?? (await promptForYamlFile(AgentGenerateAuthoringBundle.FLAGGABLE_PROMPTS['spec']));

    // If we don't have a name yet, prompt for it
    const name = flags['name'] ?? (await promptForFlag(AgentGenerateAuthoringBundle.FLAGGABLE_PROMPTS['name']));

    // If we don't have an api name yet, prompt for it
    let bundleApiName = flags['api-name'];
    if (!bundleApiName) {
      bundleApiName = generateApiName(name);
      const promptedValue = await inquirerInput({
        message: messages.getMessage('flags.api-name.prompt'),
        validate: AgentGenerateAuthoringBundle.FLAGGABLE_PROMPTS['api-name'].validate,
        default: bundleApiName,
        theme,
      });
      if (promptedValue?.length) {
        bundleApiName = promptedValue;
      }
    }

    try {
      // Get default output directory if not specified
      const defaultOutputDir = join(this.project!.getDefaultPackage().fullPath, 'main', 'default');
      const targetOutputDir = join(outputDir ?? defaultOutputDir, 'aiAuthoringBundles', name);

      // Generate file paths
      const agentPath = join(targetOutputDir, `${name}.agent`);
      const metaXmlPath = join(targetOutputDir, `${name}.aiAuthoringBundle-meta.xml`);

      // Write Agent file
      const conn = targetOrg.getConnection(flags['api-version']);
      const specContents = YAML.parse(readFileSync(spec, 'utf8')) as AgentJobSpec;
      const agent = await Agent.createAfScript(conn, specContents);
      // Create output directory if it doesn't exist
      mkdirSync(targetOutputDir, { recursive: true });
      writeFileSync(agentPath, agent);

      // Write meta.xml file
      const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<aiAuthoringBundle>
  <Label>${specContents.role}</Label>
  <BundleType>${specContents.agentType}</BundleType>
  <VersionTag>Spring2026</VersionTag>
  <VersionDescription>Initial release for ${name}</VersionDescription>
  <SourceBundleVersion></SourceBundleVersion>
  <Target></Target>
</aiAuthoringBundle>`;
      writeFileSync(metaXmlPath, metaXml);

      this.logSuccess(`Successfully generated ${name} Authoring Bundle`);

      return {
        agentPath,
        metaXmlPath,
        outputDir: targetOutputDir,
      };
    } catch (error) {
      const err = SfError.wrap(error);
      throw new SfError(messages.getMessage('error.failed-to-create-agent'), 'AgentGenerationError', [err.message]);
    }
  }
}
