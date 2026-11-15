import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ShareGate } from '../src/main/share-gate.ts'

const summary = { mode: 'link' as const, recipient: 'synthetic recipient', project: 'Synthetic project', secretNames: ['TOKEN'] }

test('one passphrase confirmation releases one operation only', async () => {
  let executions = 0
  const gate = new ShareGate(async (passphrase) => {
    assert.equal(passphrase, 'synthetic passphrase')
  }, () => undefined)
  const operation = gate.run(summary, async () => ++executions)
  const request = gate.current()
  assert.ok(request)
  await gate.confirm({ id: request.id, passphrase: 'synthetic passphrase' })
  assert.equal(await operation, 1)
  assert.equal(executions, 1)
  await assert.rejects(gate.confirm({ id: request.id, passphrase: 'synthetic passphrase' }), /No share confirmation/)
})

test('a wrong passphrase releases no operation', async () => {
  let executions = 0
  const gate = new ShareGate(async () => { throw new Error('Wrong passphrase.') }, () => undefined)
  const operation = gate.run(summary, async () => ++executions)
  const request = gate.current()
  assert.ok(request)
  await assert.rejects(gate.confirm({ id: request.id, passphrase: 'wrong synthetic passphrase' }), /Wrong passphrase/)
  assert.equal(executions, 0)
  gate.cancel()
  await assert.rejects(operation, /cancelled/)
})

test('the confirmation expires after its lifetime', async () => {
  const gate = new ShareGate(async () => undefined, () => undefined, 50)
  const operation = gate.run(summary, async () => 'released')
  await assert.rejects(operation, /expired/)
  assert.equal(gate.current(), null)
})

test('cancel rejects the active operation', async () => {
  const gate = new ShareGate(async () => undefined, () => undefined)
  const operation = gate.run(summary, async () => 'released')
  gate.cancel()
  await assert.rejects(operation, /cancelled/)
  assert.equal(gate.current(), null)
})

test('clear rejects active and queued operations', async () => {
  const gate = new ShareGate(async () => undefined, () => undefined)
  const active = gate.run(summary, async () => 'released')
  const queued = gate.run(summary, async () => 'released')
  gate.clear()
  await assert.rejects(active, /vault is locked/)
  await assert.rejects(queued, /vault is locked/)
  assert.equal(gate.current(), null)
})
