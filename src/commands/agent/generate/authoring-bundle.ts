/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { Agent, AgentJobSpec } from '@salesforce/agents';
import YAML from 'yaml';
import { FlaggablePrompt, promptForFlag } from '../../../flags.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.authoring-bundle');

export type AgentGenerateAuthoringBundleResult = {
  afScriptPath: string;
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
    'api-version': Flags.orgApiVersion(),
    spec: Flags.file({
      summary: messages.getMessage('flags.spec.summary'),
      char: 'f',
      required: true,
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
      validate: (d: string): boolean | string => d.length > 0 || 'Name cannot be empty',
      required: true,
    },
  } satisfies Record<string, FlaggablePrompt>;

  public async run(): Promise<AgentGenerateAuthoringBundleResult> {
    const { flags } = await this.parse(AgentGenerateAuthoringBundle);
    const { spec: spec, 'output-dir': outputDir, 'target-org': targetOrg } = flags;

    // If we don't have a name yet, prompt for it
    const name = flags['name'] ?? (await promptForFlag(AgentGenerateAuthoringBundle.FLAGGABLE_PROMPTS['name']));

    try {
      const conn = targetOrg.getConnection(flags['api-version']);
      const specContents = YAML.parse(readFileSync(spec, 'utf8')) as AgentJobSpec;
      const afScript = await Agent.createAfScript(conn, specContents);
      // Get default output directory if not specified
      const defaultOutputDir = join(this.project!.getDefaultPackage().fullPath, 'main', 'default', 'aiAuthoringBundle');

      const targetOutputDir = join(outputDir ?? defaultOutputDir, name);

      // Create output directory if it doesn't exist
      mkdirSync(targetOutputDir, { recursive: true });

      // Generate file paths
      const afScriptPath = join(targetOutputDir, `${name}.afscript`);
      const metaXmlPath = join(targetOutputDir, `${name}.authoring-bundle-meta.xml`);

      // Write AFScript file
      writeFileSync(afScriptPath, afScript);

      // Write meta.xml file
      const metaXml = `<?xml version="1" encoding="UTF-8"?>
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
        afScriptPath,
        metaXmlPath,
        outputDir: targetOutputDir,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new SfError(messages.getMessage('error.failed-to-create-afscript'), 'AfScriptGenerationError', [
        err.message,
      ]);
    }
  }
}
