/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
