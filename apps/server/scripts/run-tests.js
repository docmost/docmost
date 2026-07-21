#!/usr/bin/env node
/**
 * Runs the default Jest suite plus the ee/sso-auth Jest project (which
 * needs a different transformIgnorePatterns for ESM-only deps like
 * openid-client/oauth4webapi/jose -- see apps/server/jest.config.ee.js).
 *
 * A plain `jest && jest --config jest.config.ee.js` shell chain would
 * short-circuit on the first non-zero exit code, silently skipping the
 * ee/sso-auth run whenever an unrelated suite fails. This runs both,
 * always, and exits non-zero if either failed.
 */
const { spawnSync } = require('child_process')

const runs = [
  { label: 'default', args: [] },
  { label: 'ee/sso-auth', args: ['--config', 'jest.config.ee.js'] },
]

let exitCode = 0

for (const run of runs) {
  const result = spawnSync('jest', run.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    exitCode = result.status ?? 1
  }
}

process.exit(exitCode)
