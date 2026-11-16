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

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect } from 'chai';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import AgentMcpList from '../../../../src/commands/agent/mcp/list.js';
import AgentMcpCreate from '../../../../src/commands/agent/mcp/create.js';
import AgentMcpGet from '../../../../src/commands/agent/mcp/get.js';
import AgentMcpUpdate from '../../../../src/commands/agent/mcp/update.js';
import AgentMcpDelete from '../../../../src/commands/agent/mcp/delete.js';
import AgentMcpFetch from '../../../../src/commands/agent/mcp/fetch.js';
import AgentMcpAssetList from '../../../../src/commands/agent/mcp/asset/list.js';
import AgentMcpAssetReplace from '../../../../src/commands/agent/mcp/asset/replace.js';
import AgentMcpAssetAfscript from '../../../../src/commands/agent/mcp/asset/afscript.js';

describe('agent mcp commands', () => {
  const $$ = new TestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('list forwards --label, --type and --status as query params', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    let capturedUrl: string | undefined;
    $$.fakeConnectionRequest = (req: any) => {
      capturedUrl = req.url as string;
      return Promise.resolve({ mcpServers: [] });
    };

    await AgentMcpList.run([
      '--target-org',
      testOrg.username,
      '--label',
      'foo',
      '--type',
      'EXTERNAL',
      '--status',
      'ACTIVE',
    ]);

    expect(capturedUrl).to.include('label=foo');
    expect(capturedUrl).to.include('type=EXTERNAL');
    expect(capturedUrl).to.include('status=ACTIVE');
  });

  it('create builds the EXTERNAL/NO_AUTH body and surfaces the auto-fetched assets', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    let captured: any;
    // The server registration triggers a live auto-fetch of remote assets; we mock that
    // response in-process (the same way the ADL tests mock their external S3/indexing calls)
    // so the test is deterministic and never touches a real MCP endpoint.
    $$.fakeConnectionRequest = (req: any) => {
      captured = req;
      return Promise.resolve({
        server: { id: '0XS1', name: 'my-server', type: 'EXTERNAL', status: 'ACTIVE' },
        assets: [
          { name: 'McpTool__add', kind: 'MCP_TOOL', active: false },
          { name: 'McpTool__squareRoot', kind: 'MCP_TOOL', active: false },
        ],
      });
    };

    const result = await AgentMcpCreate.run([
      '--target-org',
      testOrg.username,
      '--name',
      'my-server',
      '--server-url',
      'https://example.com/mcp',
    ]);

    expect(captured.method).to.equal('POST');
    expect(captured.url).to.match(/\/api-catalog\/mcp-servers$/);
    const body = JSON.parse(captured.body as string);
    expect(body).to.deep.include({ name: 'my-server', type: 'EXTERNAL', serverUrl: 'https://example.com/mcp' });
    expect(body.authorization).to.deep.equal({ authType: 'NO_AUTH' });
    expect(result.server.id).to.equal('0XS1');
    expect(result.server.status).to.equal('ACTIVE');
    expect(result.assets.map((a) => a.name)).to.deep.equal(['McpTool__add', 'McpTool__squareRoot']);
  });

  it('create builds the OAUTH authorization body from the flags', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    let captured: any;
    $$.fakeConnectionRequest = (req: any) => {
      captured = req;
      return Promise.resolve({
        server: { id: '0XS2', name: 'oauth-server', type: 'EXTERNAL', status: 'ACTIVE' },
        assets: [],
      });
    };

    await AgentMcpCreate.run([
      '--target-org',
      testOrg.username,
      '--name',
      'oauth-server',
      '--server-url',
      'https://example.com/mcp',
      '--auth-type',
      'OAUTH',
      '--identity-provider',
      'https://idp.example.com/token',
      '--client-id',
      'abc123',
      '--client-secret',
      's3cr3t',
      '--scope',
      'read write',
    ]);

    const body = JSON.parse(captured.body as string);
    expect(body.authorization).to.deep.equal({
      authType: 'OAUTH',
      identityProvider: 'https://idp.example.com/token',
      clientId: 'abc123',
      clientSecret: 's3cr3t',
      scope: 'read write',
    });
  });

  it('create rejects OAUTH without the required fields', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve({} as any);

    try {
      await AgentMcpCreate.run([
        '--target-org',
        testOrg.username,
        '--name',
        'my-server',
        '--server-url',
        'https://example.com/mcp',
        '--auth-type',
        'OAUTH',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as { name: string }).name).to.equal('MissingOauthFields');
    }
  });

  it('delete with --no-prompt DELETEs without confirmation', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    let captured: any;
    $$.fakeConnectionRequest = (req: any) => {
      captured = req;
      return Promise.resolve(undefined as any);
    };

    const result = await AgentMcpDelete.run([
      '--target-org',
      testOrg.username,
      '--mcp-server-id',
      '0XS1',
      '--no-prompt',
    ]);

    expect(captured.method).to.equal('DELETE');
    expect(captured.url).to.match(/\/mcp-servers\/0XS1$/);
    expect(result).to.deep.equal({ id: '0XS1', deleted: true });
  });

  it('delete skips the prompt in --json mode (no --no-prompt)', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    let captured: any;
    $$.fakeConnectionRequest = (req: any) => {
      captured = req;
      return Promise.resolve(undefined as any);
    };

    // No --no-prompt, but --json: must NOT block on a prompt.
    const result = await AgentMcpDelete.run(['--target-org', testOrg.username, '--mcp-server-id', '0XS1', '--json']);

    expect(captured.method).to.equal('DELETE');
    expect(result).to.deep.equal({ id: '0XS1', deleted: true });
  });

  it('update builds a partial PATCH-style body and PUTs it', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    let captured: any;
    $$.fakeConnectionRequest = (req: any) => {
      captured = req;
      return Promise.resolve({ id: '0XS1', name: 'n', type: 'EXTERNAL', status: 'ACTIVE' });
    };

    await AgentMcpUpdate.run(['--target-org', testOrg.username, '--mcp-server-id', '0XS1', '--label', 'New label']);

    expect(captured.method).to.equal('PUT');
    expect(captured.url).to.match(/\/mcp-servers\/0XS1$/);
    const body = JSON.parse(captured.body as string);
    expect(body).to.deep.equal({ label: 'New label' });
  });

  it('update throws NoFields when nothing is provided', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve({} as any);

    try {
      await AgentMcpUpdate.run(['--target-org', testOrg.username, '--mcp-server-id', '0XS1']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as { name: string }).name).to.equal('NoFields');
    }
  });

  it('asset replace reads an array-shaped JSON file and PUTs the allowlist', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    const dir = mkdtempSync(join(tmpdir(), 'mcp-'));
    const file = join(dir, 'assets.json');
    writeFileSync(file, JSON.stringify([{ name: 'tool-a', active: true }]));

    let captured: any;
    $$.fakeConnectionRequest = (req: any) => {
      captured = req;
      return Promise.resolve({ assets: [{ id: '1', name: 'tool-a', kind: 'MCP_TOOL', active: true }] });
    };

    await AgentMcpAssetReplace.run([
      '--target-org',
      testOrg.username,
      '--mcp-server-id',
      '0XS1',
      '--assets-file',
      file,
    ]);

    expect(captured.method).to.equal('PUT');
    expect(captured.url).to.match(/\/mcp-servers\/0XS1\/assets$/);
    expect(JSON.parse(captured.body as string).assets[0].name).to.equal('tool-a');
  });

  it('asset replace accepts the {assets:[]} object shape', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    const dir = mkdtempSync(join(tmpdir(), 'mcp-'));
    const file = join(dir, 'assets.json');
    writeFileSync(file, JSON.stringify({ assets: [{ name: 'tool-b' }] }));

    let captured: any;
    $$.fakeConnectionRequest = (req: any) => {
      captured = req;
      return Promise.resolve({ assets: [] });
    };

    await AgentMcpAssetReplace.run([
      '--target-org',
      testOrg.username,
      '--mcp-server-id',
      '0XS1',
      '--assets-file',
      file,
    ]);

    expect(JSON.parse(captured.body as string).assets[0].name).to.equal('tool-b');
  });

  it('asset replace accepts the allowlist inline via --assets', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    let captured: any;
    $$.fakeConnectionRequest = (req: any) => {
      captured = req;
      return Promise.resolve({ assets: [{ id: '1', name: 'tool-inline', kind: 'MCP_TOOL', active: true }] });
    };

    await AgentMcpAssetReplace.run([
      '--target-org',
      testOrg.username,
      '--mcp-server-id',
      '0XS1',
      '--assets',
      '{"assets":[{"name":"tool-inline","active":true}]}',
    ]);

    expect(captured.method).to.equal('PUT');
    expect(captured.url).to.match(/\/mcp-servers\/0XS1\/assets$/);
    expect(JSON.parse(captured.body as string).assets[0].name).to.equal('tool-inline');
  });

  it('asset replace rejects passing both --assets and --assets-file', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    const dir = mkdtempSync(join(tmpdir(), 'mcp-'));
    const file = join(dir, 'assets.json');
    writeFileSync(file, JSON.stringify({ assets: [] }));
    $$.fakeConnectionRequest = () => Promise.resolve({ assets: [] } as any);

    try {
      await AgentMcpAssetReplace.run([
        '--target-org',
        testOrg.username,
        '--mcp-server-id',
        '0XS1',
        '--assets',
        '{"assets":[]}',
        '--assets-file',
        file,
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      // oclif raises a mutually-exclusive flags error before run() executes.
      expect((err as Error).message).to.match(/cannot also be provided|exclusive/i);
    }
  });

  it('asset replace throws InvalidShape for a non-asset JSON file', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    const dir = mkdtempSync(join(tmpdir(), 'mcp-'));
    const file = join(dir, 'bad.json');
    writeFileSync(file, JSON.stringify({ nope: true }));
    $$.fakeConnectionRequest = () => Promise.resolve({} as any);

    try {
      await AgentMcpAssetReplace.run([
        '--target-org',
        testOrg.username,
        '--mcp-server-id',
        '0XS1',
        '--assets-file',
        file,
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as { name: string }).name).to.equal('InvalidShape');
    }
  });

  it('get returns the server and strips the secret on read', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    let captured: any;
    $$.fakeConnectionRequest = (req: any) => {
      captured = req;
      return Promise.resolve({
        id: '0XS1',
        name: 'my-server',
        type: 'EXTERNAL',
        status: 'ACTIVE',
        // Connect API strips clientSecret on read; only non-sensitive auth metadata comes back.
        authorization: { authType: 'OAUTH', identityProvider: 'https://idp.example.com/token', scope: 'read' },
      });
    };

    const result = await AgentMcpGet.run(['--target-org', testOrg.username, '--mcp-server-id', '0XS1']);

    expect(captured.method).to.equal('GET');
    expect(captured.url).to.match(/\/mcp-servers\/0XS1$/);
    expect(result.authorization?.authType).to.equal('OAUTH');
    expect(result.authorization).to.not.have.property('clientSecret');
  });

  it('fetch POSTs to /fetch and returns the merged asset view (mocked, no live endpoint)', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    let captured: any;
    // The real /fetch contacts the remote MCP server live; here we mock it so the test is
    // deterministic and cannot hang against a sleepy external server.
    $$.fakeConnectionRequest = (req: any) => {
      captured = req;
      return Promise.resolve({
        assets: [
          { name: 'McpTool__add', kind: 'MCP_TOOL', status: 'IN_SYNC' },
          { name: 'McpTool__newTool', kind: 'MCP_TOOL', status: 'NOT_REGISTERED' },
        ],
      });
    };

    const result = await AgentMcpFetch.run(['--target-org', testOrg.username, '--mcp-server-id', '0XS1']);

    expect(captured.method).to.equal('POST');
    expect(captured.url).to.match(/\/mcp-servers\/0XS1\/fetch$/);
    expect(result.assets.map((a) => a.name)).to.include('McpTool__newTool');
  });

  it('asset list GETs the allowlist', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    let captured: any;
    $$.fakeConnectionRequest = (req: any) => {
      captured = req;
      return Promise.resolve({ assets: [{ id: '1', name: 'McpTool__add', kind: 'MCP_TOOL', active: true }] });
    };

    const result = await AgentMcpAssetList.run(['--target-org', testOrg.username, '--mcp-server-id', '0XS1']);

    expect(captured.method).to.equal('GET');
    expect(captured.url).to.match(/\/mcp-servers\/0XS1\/assets$/);
    expect(result.assets[0].name).to.equal('McpTool__add');
  });

  it('asset list renders the tool description in the human-readable table', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () =>
      Promise.resolve({
        assets: [{ id: '1', name: 'McpTool__add', kind: 'MCP_TOOL', active: true, description: 'Add two numbers' }],
      });

    await AgentMcpAssetList.run(['--target-org', testOrg.username, '--mcp-server-id', '0XS1']);

    // The table must expose a Description column so a user can review a tool before approving it.
    const tableArg = sfCommandStubs.table.firstCall.firstArg as {
      data: Array<Record<string, unknown>>;
      columns: Array<{ key: string; name: string }>;
    };
    expect(tableArg.columns.map((c) => c.key)).to.include('description');
    expect(tableArg.data[0].description).to.equal('Add two numbers');
  });

  it('create renders the tool description and security warning in the discovered-asset table', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    // The auto-fetch on create returns the same live tool metadata as /fetch,
    // including securityWarning — so the discovered-asset table must surface it.
    $$.fakeConnectionRequest = () =>
      Promise.resolve({
        server: { id: '0XS1', name: 'my-server', type: 'EXTERNAL', status: 'ACTIVE' },
        assets: [
          {
            name: 'McpTool__add',
            kind: 'MCP_TOOL',
            active: false,
            description: 'Add two numbers',
            securityWarning: 'Tool description contains text in multiple languages or scripts.',
          },
        ],
      });

    await AgentMcpCreate.run([
      '--target-org',
      testOrg.username,
      '--name',
      'my-server',
      '--server-url',
      'https://example.com/mcp',
    ]);

    const tableArg = sfCommandStubs.table.firstCall.firstArg as {
      data: Array<Record<string, unknown>>;
      columns: Array<{ key: string; name: string }>;
    };
    const keys = tableArg.columns.map((c) => c.key);
    expect(keys).to.include('description');
    expect(keys).to.include('securityWarning');
    expect(tableArg.data[0].description).to.equal('Add two numbers');
    expect(tableArg.data[0].securityWarning).to.equal(
      'Tool description contains text in multiple languages or scripts.'
    );
  });

  it('fetch renders the tool description and security warning in the human-readable table', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    // securityWarning is only populated by the live /fetch introspection.
    $$.fakeConnectionRequest = () =>
      Promise.resolve({
        assets: [
          {
            name: 'McpTool__add',
            kind: 'MCP_TOOL',
            status: 'IN_SYNC',
            description: 'Add two numbers',
            securityWarning: 'Tool description was modified since last approval.',
          },
        ],
      });

    await AgentMcpFetch.run(['--target-org', testOrg.username, '--mcp-server-id', '0XS1']);

    const tableArg = sfCommandStubs.table.firstCall.firstArg as {
      data: Array<Record<string, unknown>>;
      columns: Array<{ key: string; name: string }>;
    };
    const keys = tableArg.columns.map((c) => c.key);
    expect(keys).to.include('description');
    expect(keys).to.include('securityWarning');
    expect(tableArg.data[0].description).to.equal('Add two numbers');
    expect(tableArg.data[0].securityWarning).to.equal('Tool description was modified since last approval.');
  });
  describe('asset afscript', () => {
    const assets = [
      { id: '1XO1', name: 'McpTool__hello_world', kind: 'MCP_TOOL', active: true },
      { id: '1XO2', name: 'McpTool__add', kind: 'MCP_TOOL', active: true },
      { id: '1XO3', name: 'McpTool__off', kind: 'MCP_TOOL', active: false },
      { id: '1XO4', name: 'some_prompt', kind: 'MCP_PROMPT', active: true },
      { id: '1XO5', name: 'McpTool__no_active_field', kind: 'MCP_TOOL' },
      { id: '1XOxx000000017P', name: 'McpTool__text_stats', kind: 'MCP_TOOL', active: true },
    ];
    // Indentation as the Core service returns it: first line flush left, later lines 4 spaces.
    const action = (toolId: string, name: string) => ({
      toolId,
      genAiFunctionId: `179${toolId}`,
      name,
      source: name,
      target: `mcpTool://nc/${name}`,
      actionBlock: `${name}:\n    source: "${name}"\n    target: "mcpTool://nc/${name}"`,
      reasoningReference: `${name}: @actions.${name}\n    with a = ...`,
    });
    let posts: any[];

    async function setup(postError?: Error): Promise<MockTestOrgData> {
      const testOrg = new MockTestOrgData();
      await $$.stubAuths(testOrg);
      posts = [];
      $$.fakeConnectionRequest = (req: any) => {
        if (req.method === 'GET') return Promise.resolve({ assets });
        posts.push(req);
        if (postError) return Promise.reject(postError);
        const ids = JSON.parse(req.body as string).toolIds as string[];
        return Promise.resolve({ actions: ids.map((id) => action(id, `a${id}`)) });
      };
      return testOrg;
    }

    it('resolves --tool with and without the prefix, in order, with one API call', async () => {
      const org = await setup();
      const result = await AgentMcpAssetAfscript.run([
        '--target-org',
        org.username,
        '-i',
        '0XS1',
        '-t',
        'add',
        '-t',
        'McpTool__hello_world',
      ]);
      expect(posts).to.have.length(1);
      expect(posts[0].url).to.match(/\/connect\/genai-mcp\/agent-script\/actions$/);
      expect(JSON.parse(posts[0].body as string)).to.deep.equal({ toolIds: ['1XO2', '1XO1'] });
      expect(result.actions.map((a) => a.toolId)).to.deep.equal(['1XO2', '1XO1']);
    });

    it('prints the blocks under the two headings, indented for the .agent file (8 and 12 spaces)', async () => {
      const org = await setup();
      await AgentMcpAssetAfscript.run(['--target-org', org.username, '-i', '0XS1', '-t', 'add', '-t', 'hello_world']);
      expect(sfCommandStubs.log.firstCall.firstArg).to.equal(
        [
          '# subagent actions:',
          '        a1XO2:\n            source: "a1XO2"\n            target: "mcpTool://nc/a1XO2"',
          '        a1XO1:\n            source: "a1XO1"\n            target: "mcpTool://nc/a1XO1"',
          '# reasoning actions:',
          '            a1XO2: @actions.a1XO2\n                with a = ...',
          '            a1XO1: @actions.a1XO1\n                with a = ...',
        ].join('\n')
      );
    });

    it('--asset-id sends the raw ids after the --tool ids', async () => {
      const org = await setup();
      await AgentMcpAssetAfscript.run([
        '--target-org',
        org.username,
        '-i',
        '0XS1',
        '--asset-id',
        '1XO2',
        '--tool',
        'hello_world',
      ]);
      expect(JSON.parse(posts[0].body as string).toolIds).to.deep.equal(['1XO1', '1XO2']);
    });

    it('sends a tool whose asset has no active field (the API decides)', async () => {
      const org = await setup();
      await AgentMcpAssetAfscript.run(['--target-org', org.username, '-i', '0XS1', '-t', 'no_active_field']);
      expect(JSON.parse(posts[0].body as string).toolIds).to.deep.equal(['1XO5']);
    });

    it('--json returns {actions} and prints nothing', async () => {
      const org = await setup();
      const result = await AgentMcpAssetAfscript.run([
        '--target-org',
        org.username,
        '-i',
        '0XS1',
        '-t',
        'add',
        '--json',
      ]);
      expect(result.actions).to.have.length(1);
      expect(sfCommandStubs.log.called).to.equal(false);
    });

    it('lists every missing name and the available tools in one error, with no POST', async () => {
      const org = await setup();
      try {
        await AgentMcpAssetAfscript.run([
          '--target-org',
          org.username,
          '-i',
          '0XS1',
          '-t',
          'nope',
          '-t',
          'McpTool__gone',
          '-t',
          'add',
        ]);
        expect.fail('should throw');
      } catch (e: any) {
        expect(e.name).to.equal('ToolNotFound');
        expect(e.message).to.include('nope, McpTool__gone');
        expect(e.message).to.include('McpTool__hello_world, McpTool__add, McpTool__off');
        expect(e.message).to.not.include('some_prompt');
      }
      expect(posts).to.have.length(0);
    });

    it('lists every inactive asset in one error, with no POST', async () => {
      const org = await setup();
      try {
        await AgentMcpAssetAfscript.run([
          '--target-org',
          org.username,
          '-i',
          '0XS1',
          '-t',
          'off',
          '--asset-id',
          '1XO3',
        ]);
        expect.fail('should throw');
      } catch (e: any) {
        expect(e.name).to.equal('AssetNotAllowlisted');
        expect(e.message).to.include('McpTool__off');
        expect(e.message).to.include('sf agent mcp asset replace');
      }
      expect(posts).to.have.length(0);
    });

    it('sends each id once when --tool and --asset-id name the same tool', async () => {
      const org = await setup();
      await AgentMcpAssetAfscript.run([
        '--target-org',
        org.username,
        '-i',
        '0XS1',
        '-t',
        'add',
        '-t',
        'add',
        '--asset-id',
        '1XO2',
      ]);
      expect(JSON.parse(posts[0].body as string).toolIds).to.deep.equal(['1XO2']);
    });

    it('matches an 18-char id with a correct checksum to the 15-char asset id, and sends it once', async () => {
      const org = await setup();
      await AgentMcpAssetAfscript.run([
        '--target-org',
        org.username,
        '-i',
        '0XS1',
        '--asset-id',
        '1XOxx000000017PGAQ',
        '--asset-id',
        '1XOxx000000017P',
      ]);
      expect(JSON.parse(posts[0].body as string).toolIds).to.deep.equal(['1XOxx000000017P']);
    });

    it('treats an 18-char id with a wrong checksum as missing', async () => {
      const org = await setup();
      try {
        await AgentMcpAssetAfscript.run([
          '--target-org',
          org.username,
          '-i',
          '0XS1',
          '--asset-id',
          '1XOxx000000017PAAA',
        ]);
        expect.fail('should throw');
      } catch (e: any) {
        expect(e.name).to.equal('ToolNotFound');
        expect(e.message).to.include('1XOxx000000017PAAA');
      }
      expect(posts).to.have.length(0);
    });

    it('treats an unknown id and a non-MCP_TOOL id as missing, once each', async () => {
      const org = await setup();
      try {
        await AgentMcpAssetAfscript.run([
          '--target-org',
          org.username,
          '-i',
          '0XS1',
          '--asset-id',
          '1XOZ',
          '--asset-id',
          '1XO4',
          '--asset-id',
          '1XOZ',
        ]);
        expect.fail('should throw');
      } catch (e: any) {
        expect(e.name).to.equal('ToolNotFound');
        expect(e.message).to.include('1XOZ, 1XO4. Available');
      }
      expect(posts).to.have.length(0);
    });

    it('reports missing and inactive together in one error', async () => {
      const org = await setup();
      try {
        await AgentMcpAssetAfscript.run(['--target-org', org.username, '-i', '0XS1', '-t', 'nope', '-t', 'off']);
        expect.fail('should throw');
      } catch (e: any) {
        expect(e.message).to.include('Not found on the MCP server: nope');
        expect(e.message).to.include('Not allowlisted: McpTool__off');
        expect(e.oclif?.exit ?? e.exitCode).to.equal(1);
      }
    });

    it('maps a jsforce-shaped 400 (name=BAD_REQUEST, Core message) and keeps the text', async () => {
      const msg = 'These tool ids are not connected MCP tools: [1XO2]';
      const err = Object.assign(new Error(msg), { name: 'BAD_REQUEST', errorCode: 'BAD_REQUEST' });
      const org = await setup(err);
      try {
        await AgentMcpAssetAfscript.run(['--target-org', org.username, '-i', '0XS1', '-t', 'add']);
        expect.fail('should throw');
      } catch (e: any) {
        expect(e.message).to.include('(400)');
        expect(e.message).to.include(msg);
      }
    });

    it('says the org needs API 68.0 (release 264) on NOT_FOUND', async () => {
      const err = Object.assign(new Error('The requested resource does not exist'), { name: 'NOT_FOUND' });
      const org = await setup(err);
      try {
        await AgentMcpAssetAfscript.run(['--target-org', org.username, '-i', '0XS1', '-t', 'add']);
        expect.fail('should throw');
      } catch (e: any) {
        expect(e.message).to.include('68.0 (release 264)');
        expect(e.message).to.include('The requested resource does not exist');
      }
    });

    it('requires --tool or --asset-id', async () => {
      const org = await setup();
      try {
        await AgentMcpAssetAfscript.run(['--target-org', org.username, '-i', '0XS1']);
        expect.fail('should throw');
      } catch (e: any) {
        expect(e.name).to.equal('NoToolSelected');
      }
    });

    for (const [name, msg, expected] of [
      ['BAD_REQUEST', 'These tool ids are not connected MCP tools: [1XO2]', 'API rejected the request (400)'],
      ['FUNCTIONALITY_NOT_ENABLED', 'The MCP agent-script API is not enabled for this org.', 'denied access (403)'],
    ]) {
      it(`maps API ${name} to a clear error that keeps the API message`, async () => {
        const err = new Error(msg);
        err.name = name;
        const org = await setup(err);
        try {
          await AgentMcpAssetAfscript.run(['--target-org', org.username, '-i', '0XS1', '-t', 'add']);
          expect.fail('should throw');
        } catch (e: any) {
          expect(e.message).to.include(expected);
          expect(e.message).to.include(msg);
        }
      });
    }
  });
});
