/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
module.exports = {
  extends: [
    'eslint-config-salesforce-typescript',
    'eslint-config-salesforce-license',
    'plugin:sf-plugin/recommended',
    'xo-react/space',
  ],
  root: true,
  rules: {
    'react/jsx-tag-spacing': 'off',
  },
};
