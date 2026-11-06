import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import worker from '../workers/daechion/billing.cjs'

test('default disabled worker CLI exits without loading a database or provider', () => {
  const result = spawnSync(process.execPath, ['workers/daechion/billing.cjs'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, DAECHION_BILLING_WORKER_ENABLED: '', DAECHION_DATABASE_URL: 'must-not-connect', PAYSSAM_API_KEY: 'must-not-print' },
  })
  assert.equal(result.status, 0)
  assert.deepEqual(JSON.parse(result.stdout), { enabled: false })
  assert.equal(result.stderr, '')
})

test('connection check never starts a send cycle even when sending and --once are enabled', async () => {
  const calls = [], output = []
  await worker.main({ argv: ['--check', '--once'], env: { DAECHION_BILLING_WORKER_ENABLED: 'true', DAECHION_BILLING_SEND_ENABLED: 'true' },
    makeRuntime: () => ({ check: async () => { calls.push('check') }, cycle: async () => { calls.push('send') } }),
    write: value => output.push(value),
  })
  assert.deepEqual(calls, ['check'])
  assert.deepEqual(output, [{ ready: true, schema: 'daechion_automation', sending: false }])
})

test('once mode checks readiness and passes explicit send permission; failed checks cannot send', async () => {
  const calls = []
  for (const flag of [undefined, 'false', 'true']) {
    await worker.main({ argv: ['--once'], env: { DAECHION_BILLING_WORKER_ENABLED: 'true', DAECHION_BILLING_SEND_ENABLED: flag },
      makeRuntime: () => ({ check: async () => {}, cycle: async enabled => { calls.push(enabled); return {} } }), write: () => {},
    })
  }
  assert.deepEqual(calls, [false, false, true])
  await assert.rejects(worker.main({ argv: ['--once'], env: { DAECHION_BILLING_WORKER_ENABLED: 'true', DAECHION_BILLING_SEND_ENABLED: 'true' },
    makeRuntime: () => ({ check: async () => { throw Error('not ready') }, cycle: async () => { throw Error('must not send') } }),
  }), /not ready/)
  await assert.rejects(worker.main({ argv: ['--check'], env: {} }), /DISABLED/)
  await assert.rejects(worker.main({ argv: ['--send-everything'], env: {} }), /INVALID_WORKER_ARGUMENT/)
})
