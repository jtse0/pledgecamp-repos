module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
    mocha: true,
  },
  globals: {
    ethers: true,
  },
  extends: ['eslint:recommended'],
  rules: {
    radix: ['error', 'as-needed'],
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'space-before-function-paren': 'off',
    'padded-blocks': 'off',
    semi: ['error', 'always', { omitLastInOneLineBlock: true }],
    'max-len': ['error', { code: 120, ignorePattern: '^\\s*<path' }],
    'no-param-reassign': [2, { props: false }],
    'object-curly-newline': [
      'error',
      {
        consistent: true,
        multiline: true,
      },
    ],
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 2020,
  },
};
