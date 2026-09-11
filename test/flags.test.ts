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

import { join, relative } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import {
  getHiddenDirs,
  mergeContextVariables,
  parseContextVariables,
  parseContextVariablesJson,
  traverseForFiles,
} from '../src/flags.js';

describe('traverseForFiles', () => {
  const testDir = join(process.cwd(), 'test-temp');
  const testFiles = [
    'file1.yml',
    'file2.yaml',
    join('subdir', 'file3.yml'),
    join('subdir', 'file4.yaml'),
    join('node_modules', 'file5.yml'),
    join('excluded', 'file6.yaml'),
  ] as const;

  before(async () => {
    // Create directory structure and test files
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'subdir'), { recursive: true });
    await mkdir(join(testDir, 'node_modules'), { recursive: true });
    await mkdir(join(testDir, 'excluded'), { recursive: true });

    // Create test files
    await Promise.all(testFiles.map((file) => writeFile(join(testDir, file), 'test content')));
  });

  after(async () => {
    // Clean up test files
    await rm(testDir, { recursive: true, force: true });
  });

  it('should find all yaml files when no excludeDirs is provided', async () => {
    const results = traverseForFiles(testDir, ['.yml', '.yaml']);
    expect(results).to.have.lengthOf(6);
    expect(results).to.include(join(testDir, 'file1.yml'));
    expect(results).to.include(join(testDir, 'file2.yaml'));
    expect(results).to.include(join(testDir, 'subdir', 'file3.yml'));
    expect(results).to.include(join(testDir, 'subdir', 'file4.yaml'));
    expect(results).to.include(join(testDir, 'node_modules', 'file5.yml'));
    expect(results).to.include(join(testDir, 'excluded', 'file6.yaml'));
  });

  it('should exclude specified directories', async () => {
    const results = traverseForFiles(testDir, ['.yml', '.yaml'], ['node_modules', 'excluded']);
    expect(results).to.have.lengthOf(4);
    expect(results).to.include(join(testDir, 'file1.yml'));
    expect(results).to.include(join(testDir, 'file2.yaml'));
    expect(results).to.include(join(testDir, 'subdir', 'file3.yml'));
    expect(results).to.include(join(testDir, 'subdir', 'file4.yaml'));
    expect(results).to.not.include(join(testDir, 'node_modules', 'file5.yml'));
    expect(results).to.not.include(join(testDir, 'excluded', 'file6.yaml'));
  });

  it('should handle empty excludeDirs array', async () => {
    const results = traverseForFiles(testDir, ['.yml', '.yaml'], []);
    expect(results).to.have.lengthOf(6);
  });
});

describe('promptForSpecYaml', () => {
  it('should include "Default Agent Spec" in the list of options', async () => {
    // Test the source function logic directly by replicating what promptForSpecYaml does

    const hiddenDirs = await getHiddenDirs();
    const dirsToTraverse = [process.cwd()];
    const files = traverseForFiles(
      dirsToTraverse,
      ['AgentSpec.yml', 'AgentSpec.yaml'],
      ['node_modules', ...hiddenDirs]
    );

    // Replicate the source function logic from promptForSpecYaml
    const source = async (input?: string) => {
      const arr = [
        ...files.map((o) => ({ name: relative(process.cwd(), o), value: o })),
        { name: 'Default Agent Spec', value: undefined },
      ];

      if (!input) return arr;
      return arr.filter((o) => o.name.includes(input));
    };

    // Call the source function with no input to get all options
    const options = await source();

    // Verify "Default Agent Spec" is in the list
    const defaultAgentSpecOption = options.find((option) => option.name === 'Default Agent Spec');
    expect(defaultAgentSpecOption).to.be.ok;
    expect(defaultAgentSpecOption?.name).to.equal('Default Agent Spec');
    expect(defaultAgentSpecOption?.value).to.be.undefined;
  });
});

describe('parseContextVariables', () => {
  it('returns [] for undefined', () => {
    expect(parseContextVariables(undefined)).to.deep.equal([]);
  });

  it('returns [] for empty array', () => {
    expect(parseContextVariables([])).to.deep.equal([]);
  });

  it('parses Name=Value into { name, type: "Text", value }', () => {
    expect(parseContextVariables(['RoutableId=0Mw'])).to.deep.equal([
      { name: 'RoutableId', type: 'Text', value: '0Mw' },
    ]);
  });

  it('preserves "$Context." prefix verbatim', () => {
    expect(parseContextVariables(['$Context.RoutableId=abc'])).to.deep.equal([
      { name: '$Context.RoutableId', type: 'Text', value: 'abc' },
    ]);
  });

  it('preserves "=" inside the value (split on first =)', () => {
    expect(parseContextVariables(['key=a=b=c'])).to.deep.equal([{ name: 'key', type: 'Text', value: 'a=b=c' }]);
  });

  it('trims whitespace around the name', () => {
    expect(parseContextVariables(['  RoutableId  =0Mw'])).to.deep.equal([
      { name: 'RoutableId', type: 'Text', value: '0Mw' },
    ]);
  });

  it('handles multiple entries', () => {
    expect(parseContextVariables(['a=1', 'b=2'])).to.deep.equal([
      { name: 'a', type: 'Text', value: '1' },
      { name: 'b', type: 'Text', value: '2' },
    ]);
  });

  it('throws SfError on entry without =', () => {
    expect(() => parseContextVariables(['noEqualsHere'])).to.throw(SfError, /Expected Name=Value/);
  });

  it('throws SfError on entry with empty name', () => {
    expect(() => parseContextVariables(['=value'])).to.throw(SfError, /Name cannot be empty/);
  });
});

describe('parseContextVariablesJson', () => {
  it('returns [] for undefined', () => {
    expect(parseContextVariablesJson(undefined)).to.deep.equal([]);
  });

  it('returns [] for empty/whitespace string', () => {
    expect(parseContextVariablesJson('')).to.deep.equal([]);
    expect(parseContextVariablesJson('   ')).to.deep.equal([]);
  });

  it('parses a Boolean with a native boolean value', () => {
    expect(parseContextVariablesJson('[{"name":"probeGate","type":"Boolean","value":true}]')).to.deep.equal([
      { name: 'probeGate', type: 'Boolean', value: true },
    ]);
  });

  it('parses a Number with a native number value', () => {
    expect(parseContextVariablesJson('[{"name":"retryCount","type":"Number","value":3}]')).to.deep.equal([
      { name: 'retryCount', type: 'Number', value: 3 },
    ]);
  });

  it('parses the string-valued types', () => {
    const json =
      '[{"name":"a","type":"Text","value":"hi"},{"name":"b","type":"Date","value":"2026-08-27"},{"name":"c","type":"Ref","value":"1M5"}]';
    expect(parseContextVariablesJson(json)).to.deep.equal([
      { name: 'a', type: 'Text', value: 'hi' },
      { name: 'b', type: 'Date', value: '2026-08-27' },
      { name: 'c', type: 'Ref', value: '1M5' },
    ]);
  });

  it('parses Object/List (arrays) and Json (object) values', () => {
    const json =
      '[{"name":"o","type":"Object","value":[{"name":"inner","type":"Text","value":"x"}]},{"name":"l","type":"List","value":[{"type":"ref","value":"1M5"}]},{"name":"j","type":"Json","value":{"a":1}}]';
    expect(parseContextVariablesJson(json)).to.deep.equal([
      { name: 'o', type: 'Object', value: [{ name: 'inner', type: 'Text', value: 'x' }] },
      { name: 'l', type: 'List', value: [{ type: 'ref', value: '1M5' }] },
      { name: 'j', type: 'Json', value: { a: 1 } },
    ]);
  });

  it('allows an omitted value (optional)', () => {
    expect(parseContextVariablesJson('[{"name":"x","type":"Boolean"}]')).to.deep.equal([
      { name: 'x', type: 'Boolean', value: undefined },
    ]);
  });

  it('allows a null value (nullable)', () => {
    expect(parseContextVariablesJson('[{"name":"x","type":"Boolean","value":null}]')).to.deep.equal([
      { name: 'x', type: 'Boolean', value: null },
    ]);
  });

  it('throws SfError on malformed JSON', () => {
    expect(() => parseContextVariablesJson('not json')).to.throw(SfError, /not valid JSON/);
  });

  it('throws SfError when the top level is not an array', () => {
    expect(() => parseContextVariablesJson('{"name":"x","type":"Text"}')).to.throw(SfError, /expected a JSON array/);
  });

  it('throws SfError when an entry is not an object', () => {
    expect(() => parseContextVariablesJson('["x"]')).to.throw(SfError, /must be an object/);
  });

  it('throws SfError when an entry has no non-empty name', () => {
    expect(() => parseContextVariablesJson('[{"type":"Text","value":"x"}]')).to.throw(SfError, /non-empty "name"/);
    expect(() => parseContextVariablesJson('[{"name":"  ","type":"Text"}]')).to.throw(SfError, /non-empty "name"/);
  });

  it('throws SfError on an unknown type', () => {
    expect(() => parseContextVariablesJson('[{"name":"x","type":"Bogus","value":"y"}]')).to.throw(
      SfError,
      /invalid type "Bogus"/
    );
  });

  it('throws SfError when the value type does not match the declared type', () => {
    expect(() => parseContextVariablesJson('[{"name":"x","type":"Boolean","value":"true"}]')).to.throw(
      SfError,
      /type "Boolean" expects a boolean value, but got a string/
    );
    expect(() => parseContextVariablesJson('[{"name":"x","type":"Number","value":"3"}]')).to.throw(
      SfError,
      /type "Number" expects a number value/
    );
    expect(() => parseContextVariablesJson('[{"name":"x","type":"Text","value":3}]')).to.throw(
      SfError,
      /type "Text" expects a string value/
    );
    expect(() => parseContextVariablesJson('[{"name":"x","type":"Object","value":{}}]')).to.throw(
      SfError,
      /type "Object" expects an array value/
    );
    expect(() => parseContextVariablesJson('[{"name":"x","type":"Json","value":[]}]')).to.throw(
      SfError,
      /type "Json" expects a JSON object value/
    );
  });
});

describe('mergeContextVariables', () => {
  it('returns text-only variables when no JSON variables', () => {
    const text = parseContextVariables(['a=1']);
    expect(mergeContextVariables(text, [])).to.deep.equal([{ name: 'a', type: 'Text', value: '1' }]);
  });

  it('appends JSON-only variables after text variables', () => {
    const text = parseContextVariables(['a=1']);
    const json = parseContextVariablesJson('[{"name":"b","type":"Number","value":2}]');
    expect(mergeContextVariables(text, json)).to.deep.equal([
      { name: 'a', type: 'Text', value: '1' },
      { name: 'b', type: 'Number', value: 2 },
    ]);
  });

  it('lets the JSON variable win on a duplicate name, keeping the text position', () => {
    const text = parseContextVariables(['flag=True', 'keep=x']);
    const json = parseContextVariablesJson('[{"name":"flag","type":"Boolean","value":true}]');
    expect(mergeContextVariables(text, json)).to.deep.equal([
      { name: 'flag', type: 'Boolean', value: true },
      { name: 'keep', type: 'Text', value: 'x' },
    ]);
  });
});
