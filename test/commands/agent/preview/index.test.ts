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

import { expect } from 'chai';
// import { Messages } from '@salesforce/core/messages';
import sinon from 'sinon';
import { AgentSource, type PreviewableAgent } from '@salesforce/agents';
import {
  type AgentData,
  UNSUPPORTED_AGENTS,
  agentIsUnsupported,
  agentIsInactive,
  validateAgent,
  sortPreviewableAgents,
  getPreviewChoiceLabel,
  getPreviewChoices,
} from '../../../../src/commands/agent/preview.js';

// TODO - pull in error messages
// Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
// const messages = Messages.loadMessages('@salesforce/plugin-agent', 'preview');

describe('Agent Preview', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('filters unsupported agents', () => {
    it('detects unsupported agent', () => {
      for (const agent of UNSUPPORTED_AGENTS) {
        expect(agentIsUnsupported(agent)).to.equal(true);
      }
    });

    it('detects supported agent', () => {
      expect(agentIsUnsupported('some_agent')).to.equal(false);
    });
  });

  describe('filters inactive agents', () => {
    it('detects an inactive agent', () => {
      const agent: AgentData = {
        Id: 'OXx1234567890',
        DeveloperName: 'some_agent',
        BotVersions: {
          records: [{ Status: 'Inactive' }],
        },
      };
      expect(agentIsInactive(agent)).to.equal(true);
    });

    it('detects an active agent', () => {
      const agent: AgentData = {
        Id: 'OXx1234567890',
        DeveloperName: 'some_agent',
        BotVersions: {
          records: [{ Status: 'Active' }],
        },
      };
      expect(agentIsInactive(agent)).to.equal(false);
    });

    it('detects at least one active agent', () => {
      const agent: AgentData = {
        Id: 'OXx1234567890',
        DeveloperName: 'some_agent',
        BotVersions: {
          records: [{ Status: 'Active' }, { Status: 'Inactive' }],
        },
      };
      expect(agentIsInactive(agent)).to.equal(false);
    });

    it('detects inactive agent with multiple versions', () => {
      const agent: AgentData = {
        Id: 'OXx1234567890',
        DeveloperName: 'some_agent',
        BotVersions: {
          records: [{ Status: 'Inactive' }, { Status: 'Inactive' }],
        },
      };
      expect(agentIsInactive(agent)).to.equal(true);
    });

    it('detects active with multiple active versions', () => {
      const agent: AgentData = {
        Id: 'OXx1234567890',
        DeveloperName: 'some_agent',
        BotVersions: {
          records: [{ Status: 'Active' }, { Status: 'Active' }],
        },
      };
      expect(agentIsInactive(agent)).to.equal(false);
    });
  });

  describe('validates an agent', () => {
    it('validates an active, supported agent', () => {
      const agent: AgentData = {
        Id: 'OXx1234567890',
        DeveloperName: 'some_agent',
        BotVersions: {
          records: [{ Status: 'Active' }],
        },
      };
      expect(() => validateAgent(agent)).to.not.throw();
      expect(validateAgent(agent)).to.equal(true);
    });

    it('throws an error for an inactive agent', () => {
      const agent: AgentData = {
        Id: 'OXx1234567890',
        DeveloperName: 'some_agent',
        BotVersions: {
          records: [{ Status: 'Inactive' }],
        },
      };
      expect(() => validateAgent(agent)).to.throw('Agent some_agent is inactive.');
    });

    it('throws an error for an active, but unsupported agent', () => {
      const agent: AgentData = {
        Id: 'OXx1234567890',
        DeveloperName: UNSUPPORTED_AGENTS[0],
        BotVersions: {
          records: [{ Status: 'Active' }],
        },
      };
      expect(() => validateAgent(agent)).to.throw(`Agent ${UNSUPPORTED_AGENTS[0]} is not supported.`);
    });
  });

  describe('agent source types', () => {
    it('should support script agent source type', () => {
      const scriptAgent = {
        DeveloperName: 'test-agent',
        source: 'script' as const,
        path: '/path/to/agent.agent',
      };
      expect(scriptAgent.source).to.equal('script');
    });

    it('should support published agent source type', () => {
      const publishedAgent = {
        Id: 'OXx1234567890',
        DeveloperName: 'test-agent',
        source: 'published' as const,
      };
      expect(publishedAgent.source).to.equal('published');
    });
  });

  describe('sortPreviewableAgents', () => {
    it('places script agents before published agents', () => {
      const agents: PreviewableAgent[] = [
        { name: 'Published_Agent', source: AgentSource.PUBLISHED, developerName: 'Published_Agent' },
        { name: 'Script_Agent', source: AgentSource.SCRIPT },
      ];
      const sorted = sortPreviewableAgents(agents);
      expect(sorted[0].source).to.equal(AgentSource.SCRIPT);
      expect(sorted[1].source).to.equal(AgentSource.PUBLISHED);
    });

    it('sorts alphabetically within the same source type', () => {
      const agents: PreviewableAgent[] = [
        { name: 'Zebra_Agent', source: AgentSource.SCRIPT },
        { name: 'Alpha_Agent', source: AgentSource.SCRIPT },
        { name: 'Middle_Agent', source: AgentSource.SCRIPT },
      ];
      const sorted = sortPreviewableAgents(agents);
      expect(sorted.map((a) => a.name)).to.deep.equal(['Alpha_Agent', 'Middle_Agent', 'Zebra_Agent']);
    });

    it('sorts by type first, then alphabetically', () => {
      const agents: PreviewableAgent[] = [
        { name: 'Zebra_Published', source: AgentSource.PUBLISHED, developerName: 'Zebra_Published' },
        { name: 'Beta_Script', source: AgentSource.SCRIPT },
        { name: 'Alpha_Published', source: AgentSource.PUBLISHED, developerName: 'Alpha_Published' },
        { name: 'Alpha_Script', source: AgentSource.SCRIPT },
      ];
      const sorted = sortPreviewableAgents(agents);
      expect(sorted.map((a) => a.name)).to.deep.equal([
        'Alpha_Script',
        'Beta_Script',
        'Alpha_Published',
        'Zebra_Published',
      ]);
    });

    it('does not mutate the original array', () => {
      const agents: PreviewableAgent[] = [
        { name: 'B_Agent', source: AgentSource.SCRIPT },
        { name: 'A_Agent', source: AgentSource.SCRIPT },
      ];
      sortPreviewableAgents(agents);
      expect(agents[0].name).to.equal('B_Agent');
    });
  });

  describe('getPreviewChoiceLabel', () => {
    it('uses developerName for published agents', () => {
      const agent: PreviewableAgent = {
        name: 'My Friendly Label',
        source: AgentSource.PUBLISHED,
        developerName: 'My_Api_Name',
      };
      expect(getPreviewChoiceLabel(agent)).to.equal('My_Api_Name (Published)');
    });

    it('falls back to name when developerName is undefined for published agents', () => {
      const agent: PreviewableAgent = {
        name: 'Fallback_Name',
        source: AgentSource.PUBLISHED,
      };
      expect(getPreviewChoiceLabel(agent)).to.equal('Fallback_Name (Published)');
    });

    it('uses name for script agents', () => {
      const agent: PreviewableAgent = {
        name: 'My_Script_Agent',
        source: AgentSource.SCRIPT,
      };
      expect(getPreviewChoiceLabel(agent)).to.equal('My_Script_Agent (Agent Script)');
    });
  });

  describe('getPreviewChoices', () => {
    it('returns sorted choices with correct labels', () => {
      const agents: PreviewableAgent[] = [
        { name: 'Published Label', source: AgentSource.PUBLISHED, developerName: 'Published_Api' },
        { name: 'Script_Agent', source: AgentSource.SCRIPT },
      ];
      const choices = getPreviewChoices(agents);
      expect(choices).to.have.length(2);
      expect(choices[0].name).to.equal('Script_Agent (Agent Script)');
      expect(choices[1].name).to.equal('Published_Api (Published)');
    });

    it('returns empty array for empty input', () => {
      expect(getPreviewChoices([])).to.deep.equal([]);
    });
  });
});
