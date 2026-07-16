import vue from 'eslint-plugin-vue';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: await import('@typescript-eslint/parser'),
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
      // Ionic web components target named slots via the native `slot="start"`
      // attribute; this rule is a false positive for them (auto-fixing to a
      // Vue slot directive would break Ionic rendering).
      'vue/no-deprecated-slot-attribute': 'off',
    },
  },
];
