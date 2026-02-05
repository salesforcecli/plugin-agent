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

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import { createCache, validatePreviewSession } from '../src/previewSessionStore.js';

describe('previewSessionStore', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = mkdtempSync(join(tmpdir(), 'preview-session-store-'));
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
  });

  describe('createCache', () => {
    it('saves session with authoring-bundle', async () => {
      await createCache(projectPath, {
        sessionId: 'sess-1',
        orgUsername: 'user@org.com',
        aabName: 'My_Bundle',
      });
      await validatePreviewSession(projectPath, 'sess-1', {
        aabName: 'My_Bundle',
        orgUsername: 'user@org.com',
      });
    });

    it('saves session with api-name', async () => {
      await createCache(projectPath, {
        sessionId: 'sess-2',
        orgUsername: 'user@org.com',
        apiNameOrId: 'My_Published_Agent',
      });
      await validatePreviewSession(projectPath, 'sess-2', {
        apiNameOrId: 'My_Published_Agent',
        orgUsername: 'user@org.com',
      });
    });

    it('allows multiple sessions in same store', async () => {
      await createCache(projectPath, {
        sessionId: 'sess-a',
        orgUsername: 'user@org.com',
        aabName: 'Bundle_A',
      });
      await createCache(projectPath, {
        sessionId: 'sess-b',
        orgUsername: 'user@org.com',
        apiNameOrId: 'Agent_B',
      });
      await validatePreviewSession(projectPath, 'sess-a', {
        aabName: 'Bundle_A',
        orgUsername: 'user@org.com',
      });
      await validatePreviewSession(projectPath, 'sess-b', {
        apiNameOrId: 'Agent_B',
        orgUsername: 'user@org.com',
      });
    });
  });

  describe('validatePreviewSession', () => {
    it('throws PreviewSessionNotFound when store file does not exist', async () => {
      try {
        await validatePreviewSession(projectPath, 'unknown-sess', {
          aabName: 'My_Bundle',
          orgUsername: 'user@org.com',
        });
        expect.fail('Expected validatePreviewSession to throw');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).name).to.equal('PreviewSessionNotFound');
        expect((e as SfError).message).to.include('No preview session found');
        expect((e as SfError).message).to.include('unknown-sess');
      }
    });

    it('throws PreviewSessionNotFound when session id not in store', async () => {
      await createCache(projectPath, {
        sessionId: 'sess-1',
        orgUsername: 'user@org.com',
        aabName: 'My_Bundle',
      });
      try {
        await validatePreviewSession(projectPath, 'other-sess', {
          aabName: 'My_Bundle',
          orgUsername: 'user@org.com',
        });
        expect.fail('Expected validatePreviewSession to throw');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).name).to.equal('PreviewSessionNotFound');
      }
    });

    it('throws PreviewSessionOrgMismatch when org differs', async () => {
      await createCache(projectPath, {
        sessionId: 'sess-1',
        orgUsername: 'user@org-a.com',
        aabName: 'My_Bundle',
      });
      try {
        await validatePreviewSession(projectPath, 'sess-1', {
          aabName: 'My_Bundle',
          orgUsername: 'user@org-b.com',
        });
        expect.fail('Expected validatePreviewSession to throw');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).name).to.equal('PreviewSessionOrgMismatch');
        expect((e as SfError).message).to.include('different target org');
        expect((e as SfError).message).to.include('user@org-a.com');
      }
    });

    it('throws PreviewSessionAgentMismatch when authoring-bundle differs', async () => {
      await createCache(projectPath, {
        sessionId: 'sess-1',
        orgUsername: 'user@org.com',
        aabName: 'Bundle_A',
      });
      try {
        await validatePreviewSession(projectPath, 'sess-1', {
          aabName: 'Bundle_B',
          orgUsername: 'user@org.com',
        });
        expect.fail('Expected validatePreviewSession to throw');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).name).to.equal('PreviewSessionAgentMismatch');
        expect((e as SfError).message).to.include('Session sess-1 was started with');
        expect((e as SfError).message).to.include('Bundle_A');
      }
    });

    it('throws PreviewSessionAgentMismatch when api-name differs', async () => {
      await createCache(projectPath, {
        sessionId: 'sess-1',
        orgUsername: 'user@org.com',
        apiNameOrId: 'Agent_A',
      });
      try {
        await validatePreviewSession(projectPath, 'sess-1', {
          apiNameOrId: 'Agent_B',
          orgUsername: 'user@org.com',
        });
        expect.fail('Expected validatePreviewSession to throw');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).name).to.equal('PreviewSessionAgentMismatch');
        expect((e as SfError).message).to.include('Agent_A');
      }
    });

    it('throws when session was started with authoring-bundle but send uses api-name', async () => {
      await createCache(projectPath, {
        sessionId: 'sess-1',
        orgUsername: 'user@org.com',
        aabName: 'My_Bundle',
      });
      try {
        await validatePreviewSession(projectPath, 'sess-1', {
          apiNameOrId: 'Some_Agent',
          orgUsername: 'user@org.com',
        });
        expect.fail('Expected validatePreviewSession to throw');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).name).to.equal('PreviewSessionAgentMismatch');
      }
    });

    it('throws when session was started with api-name but send uses authoring-bundle', async () => {
      await createCache(projectPath, {
        sessionId: 'sess-1',
        orgUsername: 'user@org.com',
        apiNameOrId: 'My_Agent',
      });
      try {
        await validatePreviewSession(projectPath, 'sess-1', {
          aabName: 'Some_Bundle',
          orgUsername: 'user@org.com',
        });
        expect.fail('Expected validatePreviewSession to throw');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).name).to.equal('PreviewSessionAgentMismatch');
      }
    });

    it('succeeds when agent and org match (authoring-bundle)', async () => {
      await createCache(projectPath, {
        sessionId: 'sess-1',
        orgUsername: 'user@org.com',
        aabName: 'My_Bundle',
      });
      await validatePreviewSession(projectPath, 'sess-1', {
        aabName: 'My_Bundle',
        orgUsername: 'user@org.com',
      });
    });

    it('succeeds when agent and org match (api-name)', async () => {
      await createCache(projectPath, {
        sessionId: 'sess-1',
        orgUsername: 'user@org.com',
        apiNameOrId: 'My_Agent',
      });
      await validatePreviewSession(projectPath, 'sess-1', {
        apiNameOrId: 'My_Agent',
        orgUsername: 'user@org.com',
      });
    });
  });
});
