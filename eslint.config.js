import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierFlat from 'eslint-config-prettier/flat';

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.json',
                globals: {
                    ...globals.browser,
                },
            },
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    varsIgnorePattern: '^_',
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-inferrable-types': 'error',
            'no-console': 'warn',
        },
    },
    prettierFlat,
];
