module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['n8n-nodes-base'],
  extends: ['plugin:n8n-nodes-base/community'],
  ignorePatterns: ['dist/**', 'tests/**', '*.config.ts'],
};
