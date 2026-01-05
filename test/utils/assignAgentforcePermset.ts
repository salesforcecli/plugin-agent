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

import { Org, User } from '@salesforce/core';

export async function assignAgentforcePermset(username: string) {
  // const username = session.orgs.get('default')!.username as string;
  const org = await Org.create({ aliasOrUsername: username });
  const connection = org.getConnection();

  // assign the EinsteinGPTPromptTemplateManager to the scratch org admin user
  const queryResult = await connection.singleRecordQuery<{ Id: string }>(
    `SELECT Id FROM User WHERE Username='${username}'`
  );
  const user = await User.create({ org });
  await user.assignPermissionSets(queryResult.Id, ['EinsteinGPTPromptTemplateManager']);
}
