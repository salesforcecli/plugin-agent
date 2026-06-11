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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */

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

describe('agent mcp commands', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
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

    await AgentMcpAssetReplace.run(['--target-org', testOrg.username, '--mcp-server-id', '0XS1', '--assets-file', file]);

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
      await AgentMcpAssetReplace.run(['--target-org', testOrg.username, '--mcp-server-id', '0XS1', '--assets-file', file]);
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
});
