module.exports = [
  {
    files: ['tests/lab12b/**/*.test.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        require: 'readonly',
        test: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none' }]
    }
  }
];
