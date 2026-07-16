/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // testRegex (not testMatch) because this project lives under a dot-directory
  // (".ClaudeCode Projects"); micromatch globs won't traverse dot-segments in
  // the expanded <rootDir>, so a glob testMatch finds 0 tests. A plain regex
  // against the file path is immune to that. `roots` already scopes it to src/.
  testRegex: '\\.test\\.ts$',
  collectCoverageFrom: [
    'src/engine/**/*.ts',
    '!src/engine/**/*.test.ts',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
};
