import salesforce from 'eslint-config-salesforce-typescript';
import sfPlugin from 'eslint-plugin-sf-plugin';
import eslintReact from '@eslint-react/eslint-plugin';

export default [
  ...salesforce,
  ...sfPlugin.configs.recommended,
  { files: ['**/*.ts', '**/*.tsx'], ...eslintReact.configs['recommended-typescript'] },
];
