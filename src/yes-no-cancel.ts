/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  createPrompt,
  useState,
  useKeypress,
  isEnterKey,
  usePrefix,
  makeTheme,
  type Theme,
  type Status,
} from '@inquirer/core';
import type { PartialDeep } from '@inquirer/type';

type ConfirmConfig = {
  message: string;
  default?: boolean;
  transformer?: (value: boolean) => string;
  theme?: PartialDeep<Theme>;
};

function getBooleanValue(value: string, defaultValue?: boolean): boolean {
  let answer = defaultValue !== false;
  if (/^(y|yes)/i.test(value)) answer = true;
  else if (/^(n|no)/i.test(value)) answer = false;
  return answer;
}

function boolToString(value: boolean): string {
  return value ? 'Yes' : 'No';
}

// Adapted from https://github.com/SBoudrias/Inquirer.js/blob/main/packages/confirm/src/index.ts
const yesNoOrCancel: ReturnType<typeof createPrompt<boolean | 'cancel', ConfirmConfig>> = createPrompt<
  boolean | 'cancel',
  ConfirmConfig
>((config, done) => {
  const { transformer = boolToString } = config;
  const [status, setStatus] = useState<Status>('idle');
  const [value, setValue] = useState('');
  const theme = makeTheme(config.theme);
  const prefix = usePrefix({ status, theme });

  useKeypress((key, rl) => {
    if (isEnterKey(key)) {
      const answer = getBooleanValue(value, config.default);
      setValue(transformer(answer));
      setStatus('done');
      done(answer);
    } else if (key.name === 'tab') {
      const answer = boolToString(!getBooleanValue(value, config.default));
      rl.clearLine(0); // Remove the tab character.
      rl.write(answer);
      setValue(answer);
    } else if (key.name === 'c') {
      setValue('cancel');
      setStatus('done');
      done('cancel');
    } else {
      setValue(rl.line);
    }
  });

  let formattedValue = value;
  let defaultValue = '';
  if (status === 'done') {
    formattedValue = theme.style.answer(value);
  } else {
    defaultValue = ` ${theme.style.defaultAnswer(config.default === false ? 'y/N/cancel' : 'Y/n/cancel')}`;
  }

  const message = theme.style.message(config.message, status);
  return `${prefix} ${message}${defaultValue} ${formattedValue}`;
});

export default yesNoOrCancel;
