module.exports = {
  extends: ['expo'],
  ignorePatterns: ['native-legacy/', '.tools/', 'artifacts/'],
  env: { jest: true, node: true },
  overrides: [{
    files: ['__tests__/**'],
    // Jest requires lazy imports after resetModules to isolate session state.
    rules: { '@typescript-eslint/no-require-imports': 'off', 'import/first': 'off' },
  }],
};
