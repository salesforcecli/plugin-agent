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
