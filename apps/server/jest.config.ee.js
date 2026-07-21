/**
 * ee/-scoped Jest config override.
 *
 * apps/server/src/ee/sso-auth depends on openid-client/oauth4webapi/jose,
 * which ship ESM-only builds and therefore need to be transformed by
 * ts-jest instead of being left in `node_modules` untouched. Rather than
 * extending the shared `transformIgnorePatterns` in package.json (an
 * upstream-owned file Docmost's upstream edits frequently, making that a
 * recurring merge-conflict risk), that override lives here and is scoped
 * to just the ee/sso-auth spec files via `testMatch`.
 *
 * Used by the "test:ee-sso-auth" script, and chained after the default
 * `jest` run in "test" so `pnpm --filter ./apps/server run test` still
 * covers these specs.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const baseJestConfig = require('./package.json').jest

module.exports = {
  ...baseJestConfig,
  testRegex: undefined,
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['<rootDir>/ee/sso-auth/**/*.spec.ts'],
  transformIgnorePatterns: [
    '/node_modules/(?!(\\.pnpm/)?(nanoid|uuid|image-dimensions|marked|happy-dom|openid-client|oauth4webapi|jose)(@|/))',
  ],
}
