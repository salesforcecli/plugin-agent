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
import sinon from 'sinon';
import { type BotMetadata, type BotVersionMetadata, type ProductionAgent } from '@salesforce/agents';
import { getAgentChoices, getVersionChoices, getVersionForActivation } from '../src/agentActivation.js';

describe('agentActivation', () => {
  describe('getVersionChoices', () => {
    it('should mark versions with target status as disabled', () => {
      const versions: BotVersionMetadata[] = [
        {
          Id: 'v1',
          Status: 'Active',
          VersionNumber: 1,
          DeveloperName: 'Test_v1',
        } as BotVersionMetadata,
        {
          Id: 'v2',
          Status: 'Inactive',
          VersionNumber: 2,
          DeveloperName: 'Test_v2',
        } as BotVersionMetadata,
        {
          Id: 'v3',
          Status: 'Inactive',
          VersionNumber: 3,
          DeveloperName: 'Test_v3',
        } as BotVersionMetadata,
      ];

      const choices = getVersionChoices(versions, 'Inactive');

      expect(choices).to.have.lengthOf(3);
      // Sorted descending: v3, v2, v1
      expect(choices[0].disabled).to.equal('(Already Inactive)'); // Version 3 is already Inactive
      expect(choices[1].disabled).to.equal('(Already Inactive)'); // Version 2 is already Inactive
      expect(choices[2].disabled).to.equal(false); // Version 1 is Active, can be deactivated
    });

    it('should include version numbers in choices', () => {
      const versions: BotVersionMetadata[] = [
        {
          Id: 'v1',
          Status: 'Active',
          VersionNumber: 5,
          DeveloperName: 'Test_v5',
        } as BotVersionMetadata,
      ];

      const choices = getVersionChoices(versions, 'Active');

      expect(choices[0].name).to.equal('Version 5');
      expect(choices[0].value.version).to.equal(5);
      expect(choices[0].value.status).to.equal('Active');
    });

    it('should mark active versions as available for deactivation', () => {
      const versions: BotVersionMetadata[] = [
        {
          Id: 'v1',
          Status: 'Active',
          VersionNumber: 1,
          DeveloperName: 'Test_v1',
        } as BotVersionMetadata,
        {
          Id: 'v2',
          Status: 'Active',
          VersionNumber: 2,
          DeveloperName: 'Test_v2',
        } as BotVersionMetadata,
      ];

      const choices = getVersionChoices(versions, 'Inactive');

      expect(choices[0].disabled).to.equal(false);
      expect(choices[1].disabled).to.equal(false);
    });
  });

  describe('getAgentChoices', () => {
    it('should filter out agent when any version is already active (for activation)', () => {
      const agents: BotMetadata[] = [
        {
          Id: 'agent1',
          DeveloperName: 'Test_Agent',
          BotVersions: {
            records: [
              { Status: 'Active', VersionNumber: 1 } as BotVersionMetadata,
              { Status: 'Inactive', VersionNumber: 2 } as BotVersionMetadata,
              { Status: 'Inactive', VersionNumber: 3 } as BotVersionMetadata,
            ],
          },
        } as BotMetadata,
      ];

      const choices = getAgentChoices(agents, 'Active');

      expect(choices).to.have.lengthOf(0); // Filtered out because it already has an active version
    });

    it('should include agent when it has an active version (for deactivation)', () => {
      const agents: BotMetadata[] = [
        {
          Id: 'agent1',
          DeveloperName: 'Test_Agent',
          BotVersions: {
            records: [
              { Status: 'Inactive', VersionNumber: 1 } as BotVersionMetadata,
              { Status: 'Active', VersionNumber: 2 } as BotVersionMetadata, // Can be deactivated
              { Status: 'Inactive', VersionNumber: 3 } as BotVersionMetadata,
            ],
          },
        } as BotMetadata,
      ];

      const choices = getAgentChoices(agents, 'Inactive');

      expect(choices).to.have.lengthOf(1);
      expect(choices[0].value.DeveloperName).to.equal('Test_Agent');
    });

    it('should include agent when all versions are inactive (for activation)', () => {
      const agents: BotMetadata[] = [
        {
          Id: 'agent1',
          DeveloperName: 'Test_Agent',
          BotVersions: {
            records: [
              { Status: 'Inactive', VersionNumber: 1 } as BotVersionMetadata,
              { Status: 'Inactive', VersionNumber: 2 } as BotVersionMetadata,
              { Status: 'Inactive', VersionNumber: 3 } as BotVersionMetadata,
            ],
          },
        } as BotMetadata,
      ];

      const choices = getAgentChoices(agents, 'Active');

      expect(choices).to.have.lengthOf(1); // All versions are inactive, so can activate one
      expect(choices[0].value.DeveloperName).to.equal('Test_Agent');
    });

    it('should filter out agent when all versions are inactive (for deactivation)', () => {
      const agents: BotMetadata[] = [
        {
          Id: 'agent1',
          DeveloperName: 'Test_Agent',
          BotVersions: {
            records: [
              { Status: 'Inactive', VersionNumber: 1 } as BotVersionMetadata,
              { Status: 'Inactive', VersionNumber: 2 } as BotVersionMetadata,
            ],
          },
        } as BotMetadata,
      ];

      const choices = getAgentChoices(agents, 'Inactive');

      expect(choices).to.have.lengthOf(0); // All versions are already inactive, nothing to deactivate
    });

    it('should filter out unsupported agents', () => {
      const agents: BotMetadata[] = [
        {
          Id: 'agent1',
          DeveloperName: 'Copilot_for_Salesforce',
          BotVersions: {
            records: [{ Status: 'Inactive', VersionNumber: 1 } as BotVersionMetadata],
          },
        } as BotMetadata,
      ];

      const choices = getAgentChoices(agents, 'Active');

      expect(choices).to.have.lengthOf(0); // Unsupported agents are filtered out
    });

    it('should filter out unavailable agents and sort remaining alphabetically', () => {
      const agents: BotMetadata[] = [
        {
          Id: 'agent1',
          DeveloperName: 'Zebra_Agent',
          BotVersions: {
            records: [
              { Status: 'Active', VersionNumber: 1 } as BotVersionMetadata,
              { Status: 'Inactive', VersionNumber: 2 } as BotVersionMetadata,
            ],
          },
        } as BotMetadata,
        {
          Id: 'agent2',
          DeveloperName: 'Beta_Agent',
          BotVersions: {
            records: [
              { Status: 'Active', VersionNumber: 1 } as BotVersionMetadata,
              { Status: 'Inactive', VersionNumber: 2 } as BotVersionMetadata,
            ],
          },
        } as BotMetadata,
        {
          Id: 'agent3',
          DeveloperName: 'Alpha_Agent',
          BotVersions: {
            records: [
              { Status: 'Inactive', VersionNumber: 1 } as BotVersionMetadata,
              { Status: 'Inactive', VersionNumber: 2 } as BotVersionMetadata,
            ],
          },
        } as BotMetadata,
      ];

      const choices = getAgentChoices(agents, 'Active');

      expect(choices).to.have.lengthOf(1); // Only Alpha_Agent has no active version (all inactive)
      expect(choices[0].value.DeveloperName).to.equal('Alpha_Agent');
    });

    it('should sort multiple available agents alphabetically', () => {
      const agents: BotMetadata[] = [
        {
          Id: 'agent1',
          DeveloperName: 'Zebra_Agent',
          BotVersions: {
            records: [
              { Status: 'Inactive', VersionNumber: 1 } as BotVersionMetadata,
              { Status: 'Inactive', VersionNumber: 2 } as BotVersionMetadata,
            ],
          },
        } as BotMetadata,
        {
          Id: 'agent2',
          DeveloperName: 'Alpha_Agent',
          BotVersions: {
            records: [
              { Status: 'Inactive', VersionNumber: 1 } as BotVersionMetadata,
              { Status: 'Inactive', VersionNumber: 2 } as BotVersionMetadata,
            ],
          },
        } as BotMetadata,
        {
          Id: 'agent3',
          DeveloperName: 'Beta_Agent',
          BotVersions: {
            records: [{ Status: 'Inactive', VersionNumber: 1 } as BotVersionMetadata],
          },
        } as BotMetadata,
      ];

      const choices = getAgentChoices(agents, 'Active');

      expect(choices).to.have.lengthOf(3);
      expect(choices[0].value.DeveloperName).to.equal('Alpha_Agent');
      expect(choices[1].value.DeveloperName).to.equal('Beta_Agent');
      expect(choices[2].value.DeveloperName).to.equal('Zebra_Agent');
    });
  });

  describe('getVersionForActivation', () => {
    let mockAgent: sinon.SinonStubbedInstance<ProductionAgent>;

    beforeEach(() => {
      mockAgent = {
        getBotMetadata: sinon.stub(),
      } as unknown as sinon.SinonStubbedInstance<ProductionAgent>;
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should return version flag when provided', async () => {
      const result = await getVersionForActivation({
        agent: mockAgent as unknown as ProductionAgent,
        status: 'Active',
        versionFlag: 5,
      });

      expect(result.version).to.equal(5);
      expect(result.warning).to.be.undefined;
      expect(mockAgent.getBotMetadata.called).to.be.false;
    });

    it('should auto-select when only one version exists', async () => {
      mockAgent.getBotMetadata.resolves({
        BotVersions: {
          records: [{ VersionNumber: 3, Status: 'Inactive', IsDeleted: false } as BotVersionMetadata],
        },
      } as BotMetadata);

      const result = await getVersionForActivation({
        agent: mockAgent as unknown as ProductionAgent,
        status: 'Active',
      });

      expect(result.version).to.equal(3);
      expect(result.warning).to.be.undefined;
    });

    it('should auto-select when only one available choice exists', async () => {
      mockAgent.getBotMetadata.resolves({
        BotVersions: {
          records: [
            { VersionNumber: 1, Status: 'Active', IsDeleted: false } as BotVersionMetadata,
            { VersionNumber: 2, Status: 'Inactive', IsDeleted: false } as BotVersionMetadata,
          ],
        },
      } as BotMetadata);

      const result = await getVersionForActivation({
        agent: mockAgent as unknown as ProductionAgent,
        status: 'Active',
      });

      // Only version 2 is available (inactive), version 1 is already active
      expect(result.version).to.equal(2);
      expect(result.warning).to.be.undefined;
    });

    it('should auto-select latest version in JSON mode', async () => {
      mockAgent.getBotMetadata.resolves({
        BotVersions: {
          records: [
            { VersionNumber: 1, Status: 'Inactive', IsDeleted: false } as BotVersionMetadata,
            { VersionNumber: 2, Status: 'Inactive', IsDeleted: false } as BotVersionMetadata,
            { VersionNumber: 3, Status: 'Inactive', IsDeleted: false } as BotVersionMetadata,
          ],
        },
      } as BotMetadata);

      const result = await getVersionForActivation({
        agent: mockAgent as unknown as ProductionAgent,
        status: 'Active',
        jsonEnabled: true,
      });

      expect(result.version).to.equal(3);
      expect(result.warning).to.include('automatically selected latest available version: 3');
    });

    it('should filter out deleted versions', async () => {
      mockAgent.getBotMetadata.resolves({
        BotVersions: {
          records: [
            { VersionNumber: 1, Status: 'Inactive', IsDeleted: true } as BotVersionMetadata,
            { VersionNumber: 2, Status: 'Inactive', IsDeleted: false } as BotVersionMetadata,
          ],
        },
      } as BotMetadata);

      const result = await getVersionForActivation({
        agent: mockAgent as unknown as ProductionAgent,
        status: 'Active',
      });

      // Only version 2 should be considered (version 1 is deleted)
      expect(result.version).to.equal(2);
    });

    it('should throw error when no versions are available', async () => {
      mockAgent.getBotMetadata.resolves({
        BotVersions: {
          records: [
            { VersionNumber: 1, Status: 'Active', IsDeleted: false } as BotVersionMetadata,
            { VersionNumber: 2, Status: 'Active', IsDeleted: false } as BotVersionMetadata,
          ],
        },
      } as BotMetadata);

      try {
        await getVersionForActivation({
          agent: mockAgent as unknown as ProductionAgent,
          status: 'Active',
          jsonEnabled: true,
        });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.include('No versions available to activate');
      }
    });
  });
});
