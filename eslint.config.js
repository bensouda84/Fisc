import tseslint from 'typescript-eslint';

const bannedInEngine = [
  ['CallExpression[callee.name="parseFloat"]', 'Aucun flottant dans le moteur (R6).'],
  ['CallExpression[callee.name="Number"]', 'Aucun Number dans le moteur : utiliser bigint (R6).'],
  ['CallExpression[callee.object.name="Number"][callee.property.name="parseFloat"]', 'Aucun flottant dans le moteur (R6).'],
  ['Literal[raw=/^[0-9]*\\.[0-9]+/]', 'Aucun littéral décimal dans le moteur (R6).'],
  ['MemberExpression[object.name="Math"][property.name="random"]', 'Moteur déterministe : pas d’aléa.'],
  ['MemberExpression[object.name="Date"]', 'Moteur pur : la date est un paramètre.'],
  ['NewExpression[callee.name="Date"]', 'Moteur pur : la date est un paramètre.'],
  ['CallExpression[callee.name="fetch"]', 'Moteur pur : pas d’entrée-sortie.'],
].map(([selector, message]) => ({ selector, message }));

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/coverage/**', '**/dist/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...bannedInEngine],
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['node:*', 'fs', 'path', 'http', 'https', 'child_process'], message: 'Moteur pur : pas d’entrée-sortie (ADR-0001).' }] },
      ],
      'no-restricted-globals': ['error', 'process', 'fetch', 'console', 'setTimeout'],
    },
  },
);
