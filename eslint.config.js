import globals from 'globals';
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
    {
        files: ['**/*.js'],
    },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },
    js.configs.recommended,
    {
        rules: {
            'no-unused-vars': [
                'error',
                {
                    varsIgnorePattern: '^_',
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                    reportUsedIgnorePattern: true,
                },
            ],
            'no-console': 'warn',
        },
    },
    eslintConfigPrettier,
];
