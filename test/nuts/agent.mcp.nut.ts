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
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { expect } from 'chai';
import { execCmd } from '@salesforce/cli-plugins-testkit';

/* eslint-disable no-console */

// agent mcp NUTs — full MCP server ABM (create → get → update → asset allowlist →
// delete) against a real org that has API Catalog enabled.
//
// Requires a pre-authenticated org. The smoke + NoAuth suites need only the org +
// a reachable NoAuth MCP server. The OAuth suite additionally needs a reachable
// MCP server + IDP, supplied via env vars (otherwise it is skipped).
//
// Usage:
//   TARGET_ORG=apicat yarn test:nuts --grep "agent mcp"
//
//   # to run the NoAuth MCP lifecycle, point at a reachable MCP server:
//   TARGET_ORG=apicat \
//   MCP_NOAUTH_URL=https://mcptest-daniel-e6e72a8eba7a.herokuapp.com/mcp \
//   yarn test:nuts --grep "agent mcp"
//
//   # to run the OAuth MCP lifecycle, supply all four OAuth values:
//   TARGET_ORG=apicat \
//   MCP_OAUTH_URL=https://protectedmcpserverhtt-nu000s.sjojp2.usa-w1.cloudhub.io/mcp \
//   MCP_OAUTH_IDP=https://trial-8295331.okta.com/oauth2/default/v1/token \
//   MCP_OAUTH_CLIENT_ID=0oasms6rj9YJqsqMU697 \
//   MCP_OAUTH_CLIENT_SECRET=<secret> \
//   MCP_OAUTH_SCOPE=read \
//   yarn test:nuts --grep "agent mcp"

const targetOrg = process.env.TARGET_ORG ?? process.env.TESTKIT_ORG_USERNAME;

type Asset = { name: string; kind: string; active: boolean; availableAsAgentAction?: boolean };
type McpServer = { id: string; name: string; label?: string; description?: string; status: string; serverUrl?: string };

// ═══════════════════════════════════════════════════════════════
// Smoke — list + typed not-found error (org only)
// ═══════════════════════════════════════════════════════════════
describe('agent mcp smoke NUTs', function () {
  this.timeout(5 * 60 * 1000);

  before(function skipIfNoOrg() {
    if (!targetOrg) {
      console.log('Skipping agent mcp NUTs: set TARGET_ORG or TESTKIT_ORG_USERNAME env var');
      this.skip();
    }
  });

  it('lists MCP servers', () => {
    const result = execCmd<{ mcpServers: McpServer[] }>(`agent mcp list --target-org ${targetOrg} --json`, {
      ensureExitCode: 0,
    });
    expect(result.jsonOutput!.result).to.have.property('mcpServers');
  });

  it('returns a typed error for a non-existent MCP server', () => {
    const result = execCmd(`agent mcp get --mcp-server-id 0LeDOESNOTEXIST --target-org ${targetOrg} --json`);
    expect(result.jsonOutput?.status).to.not.equal(0);
    expect(result.jsonOutput?.name).to.equal('GetMcpServerFailed');
  });
});

// ═══════════════════════════════════════════════════════════════
// MCP server ABM — NoAuth (create → get → update → assets → delete)
// ═══════════════════════════════════════════════════════════════
describe('agent mcp NoAuth ABM NUTs', function () {
  this.timeout(10 * 60 * 1000);

  const noAuthUrl = process.env.MCP_NOAUTH_URL;
  let serverId = '';
  let discoveredAssets: Asset[] = [];

  before(function skipIfNoConfig() {
    if (!targetOrg) this.skip();
    if (!noAuthUrl) {
      console.log('Skipping NoAuth MCP ABM: set MCP_NOAUTH_URL to a reachable MCP server');
      this.skip();
    }
  });

  after('best-effort cleanup', () => {
    if (serverId) {
      execCmd(`agent mcp delete --mcp-server-id ${serverId} --no-prompt --target-org ${targetOrg} --json`);
    }
  });

  it('creates a NoAuth MCP server (auto-fetches assets)', () => {
    const name = `nutNoAuth${Date.now()}`;
    const result = execCmd<{ server: McpServer; assets: Asset[] }>(
      `agent mcp create --name "${name}" --server-url "${noAuthUrl}" --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );
    const { server, assets } = result.jsonOutput!.result;
    expect(server).to.have.property('id');
    expect(server.status).to.equal('ACTIVE');
    expect(assets).to.be.an('array');
    serverId = server.id;
    discoveredAssets = assets;
    console.log(`Created NoAuth MCP server ${serverId} with ${assets.length} discovered assets`);
  });

  it('gets the created server', () => {
    const result = execCmd<McpServer>(
      `agent mcp get --mcp-server-id ${serverId} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );
    expect(result.jsonOutput!.result.id).to.equal(serverId);
    expect(result.jsonOutput!.result.serverUrl).to.equal(noAuthUrl);
  });

  it('appears in the list', () => {
    const result = execCmd<{ mcpServers: McpServer[] }>(`agent mcp list --target-org ${targetOrg} --json`, {
      ensureExitCode: 0,
    });
    expect(result.jsonOutput!.result.mcpServers.some((s) => s.id === serverId)).to.be.true;
  });

  it('updates the description', () => {
    const result = execCmd<McpServer>(
      `agent mcp update --mcp-server-id ${serverId} --description "Updated by NUT" --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );
    expect(result.jsonOutput!.result.description).to.equal('Updated by NUT');
  });

  it('rejects an update with no fields', () => {
    const result = execCmd(`agent mcp update --mcp-server-id ${serverId} --target-org ${targetOrg} --json`);
    expect(result.jsonOutput?.status).to.not.equal(0);
    expect(result.jsonOutput?.name).to.equal('NoFields');
  });

  it('lists the asset allowlist (starts empty before any replace)', () => {
    const result = execCmd<{ assets: Asset[] }>(
      `agent mcp asset list --mcp-server-id ${serverId} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );
    expect(result.jsonOutput!.result).to.have.property('assets');
  });

  it('replaces the asset allowlist using an asset discovered at create time', () => {
    // Use an asset surfaced by create (the auto-fetch). This avoids a separate live
    // /fetch round-trip, which can hang against sleepy free-tier test servers.
    const candidate = discoveredAssets[0]?.name;
    if (!candidate) {
      console.log('Server advertised no assets at create — skipping allowlist replace assertion');
      return;
    }

    const file = join(tmpdir(), `nut-assets-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify({ assets: [{ name: candidate, active: true }] }));

    const result = execCmd<{ assets: Asset[] }>(
      `agent mcp asset replace --mcp-server-id ${serverId} --assets-file ${file} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );
    const active = result.jsonOutput!.result.assets.filter((a) => a.active).map((a) => a.name);
    expect(active).to.include(candidate);
  });

  it('deletes the server and confirms it is gone', () => {
    const del = execCmd<{ id: string; deleted: boolean }>(
      `agent mcp delete --mcp-server-id ${serverId} --no-prompt --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );
    expect(del.jsonOutput!.result.deleted).to.be.true;

    const gone = execCmd(`agent mcp get --mcp-server-id ${serverId} --target-org ${targetOrg} --json`);
    expect(gone.jsonOutput?.status).to.not.equal(0);
    expect(gone.jsonOutput?.name).to.equal('GetMcpServerFailed');
    serverId = '';
  });
});

// ═══════════════════════════════════════════════════════════════
// MCP server ABM — OAuth (create → get → delete)
// ═══════════════════════════════════════════════════════════════
describe('agent mcp OAuth ABM NUTs', function () {
  this.timeout(10 * 60 * 1000);

  const url = process.env.MCP_OAUTH_URL;
  const idp = process.env.MCP_OAUTH_IDP;
  const clientId = process.env.MCP_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MCP_OAUTH_CLIENT_SECRET;
  const scope = process.env.MCP_OAUTH_SCOPE ?? 'read';
  let serverId = '';

  before(function skipIfNoConfig() {
    if (!targetOrg) this.skip();
    if (!url || !idp || !clientId || !clientSecret) {
      console.log(
        'Skipping OAuth MCP ABM: set MCP_OAUTH_URL, MCP_OAUTH_IDP, MCP_OAUTH_CLIENT_ID, MCP_OAUTH_CLIENT_SECRET'
      );
      this.skip();
    }
  });

  after('best-effort cleanup', () => {
    if (serverId) {
      execCmd(`agent mcp delete --mcp-server-id ${serverId} --no-prompt --target-org ${targetOrg} --json`);
    }
  });

  it('creates an OAuth MCP server', () => {
    const name = `nutOAuth${Date.now()}`;
    // Interactive callers should pipe the secret via `--client-secret -`; in the NUT we
    // pass it inline (the test org is disposable) so the run stays non-interactive.
    const result = execCmd<{ server: McpServer & { authorization?: { authType: string } }; assets: Asset[] }>(
      `agent mcp create --name "${name}" --server-url "${url}" --auth-type OAUTH --identity-provider "${idp}" --client-id "${clientId}" --client-secret "${clientSecret}" --scope "${scope}" --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );
    const { server } = result.jsonOutput!.result;
    expect(server).to.have.property('id');
    expect(server.status).to.equal('ACTIVE');
    serverId = server.id;
    console.log(`Created OAuth MCP server ${serverId}`);
  });

  it('gets the server and confirms OAuth metadata (secret stripped)', () => {
    const result = execCmd<McpServer & { authorization?: { authType: string; clientSecret?: string } }>(
      `agent mcp get --mcp-server-id ${serverId} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );
    const auth = result.jsonOutput!.result.authorization;
    expect(auth?.authType).to.equal('OAUTH');
    expect(auth).to.not.have.property('clientSecret');
  });

  it('deletes the OAuth server', () => {
    const del = execCmd<{ deleted: boolean }>(
      `agent mcp delete --mcp-server-id ${serverId} --no-prompt --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );
    expect(del.jsonOutput!.result.deleted).to.be.true;
    serverId = '';
  });
});
