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

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { expect } from 'chai';
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';

describe('agent generate test-spec NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: join('test', 'mock-projects', 'agent-generate-template'),
      },
      devhubAuthStrategy: 'AUTO',
    });
  });

  after(async () => {
    await session?.clean();
  });

  it('should generate test spec from existing aiEvaluationDefinition', () => {
    const definitionFile = join(
      session.project.dir,
      'force-app',
      'main',
      'default',
      'aiEvaluationDefinitions',
      'Local_Info_Agent_Test.aiEvaluationDefinition-meta.xml'
    );
    const outputFile = join(session.project.dir, 'specs', genUniqueString('testSpec_%s.yaml'));

    execCmd(
      `agent generate test-spec --from-definition ${definitionFile} --output-file ${outputFile} --force-overwrite`,
      {
        ensureExitCode: 0,
      }
    );

    // Verify file exists
    expect(existsSync(outputFile)).to.be.true;
  });

  it('should fail for invalid definition file', () => {
    const invalidFile = join(session.project.dir, 'invalid', 'definition.aiEvaluationDefinition-meta.xml');
    const outputFile = join(session.project.dir, 'specs', genUniqueString('testSpec_%s.yaml'));

    execCmd(`agent generate test-spec --from-definition ${invalidFile} --output-file ${outputFile} --force-overwrite`, {
      ensureExitCode: 1,
    });
  });

  it('should fail for non-aiEvaluationDefinition file', () => {
    const invalidFile = join(
      session.project.dir,
      'force-app',
      'main',
      'default',
      'bots',
      'Local_Info_Agent',
      'Local_Info_Agent.bot-meta.xml'
    );
    const outputFile = join(session.project.dir, 'specs', genUniqueString('testSpec_%s.yaml'));

    execCmd(`agent generate test-spec --from-definition ${invalidFile} --output-file ${outputFile} --force-overwrite`, {
      ensureExitCode: 1,
    });
  });
});
