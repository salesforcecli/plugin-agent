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

import { expect } from 'chai';
// import { Messages } from '@salesforce/core/messages';
import sinon from 'sinon';
import {
  type AgentData,
  UNSUPPORTED_AGENTS,
  agentIsUnsupported,
  agentIsInactive,
  validateAgent,
  getAgentChoices,
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

  describe('gets agent choices', () => {
    it('returns agent choices', () => {
      const agents: AgentData[] = [
        {
          Id: 'OXx1234567890',
          DeveloperName: 'some_agent',
          BotVersions: {
            records: [{ Status: 'Active' }],
          },
        },
        {
          Id: 'OXx1234567891',
          DeveloperName: UNSUPPORTED_AGENTS[0],
          BotVersions: {
            records: [{ Status: 'Active' }],
          },
        },
        {
          Id: 'OXx1234567892',
          DeveloperName: 'inactive_agent',
          BotVersions: {
            records: [{ Status: 'Inactive' }],
          },
        },
      ];

      const choices = getAgentChoices(agents);
      expect(choices).to.have.lengthOf(3);

      expect(choices[0].name).to.equal('some_agent');
      expect(choices[0].value).to.deep.equal({
        Id: 'OXx1234567890',
        DeveloperName: 'some_agent',
      });
      expect(choices[0].disabled).to.equal(false);

      expect(choices[1].name).to.equal(UNSUPPORTED_AGENTS[0]);
      expect(choices[1].value).to.deep.equal({
        Id: 'OXx1234567891',
        DeveloperName: UNSUPPORTED_AGENTS[0],
      });
      expect(choices[1].disabled).to.equal('(Not Supported)');

      expect(choices[2].name).to.equal('inactive_agent');
      expect(choices[2].value).to.deep.equal({
        Id: 'OXx1234567892',
        DeveloperName: 'inactive_agent',
      });
      expect(choices[2].disabled).to.equal('(Inactive)');
    });
  });
});
