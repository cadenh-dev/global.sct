import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { readTransfer, sealReceipt, sealTransfer } from '../src/main/envelope.ts'
import { createIdentity, encodePairingLink } from '../src/main/transfer.ts'
import { encodeReceiptLink, encodeTransferLink } from '../src/main/transport-link.ts'
import { readProtocolLink } from '../src/main/protocol.ts'
import { linkLimit } from '../src/shared/transport.ts'

test('protocol reader accepts each supported route', () => {
  const sender = createIdentity('Synthetic sender')
  const recipient = createIdentity('Synthetic recipient')
  const senderId = 'a'.repeat(64)
  const recipientId = 'b'.repeat(64)
  const senderSelf = { identity: senderId, keys: sender }
  const recipientSelf = { identity: recipientId, keys: recipient }
  const sentTransfer = sealTransfer(senderSelf, [{ identity: recipientId, card: recipient.card }],
    { projectName: 'Synthetic project', secrets: [{ name: 'TOKEN', value: 'synthetic value' }],
      grant: { accessExpiresAt: null, injectionOnly: false } }, Date.now() + 60_000)
  const wrappedKey = sentTransfer.wrappedKeys[0]?.wrappedKey
  assert.ok(wrappedKey)
  const transfer = readProtocolLink(encodeTransferLink(sentTransfer.payload, wrappedKey))
  assert.equal(transfer.kind, 'import')
  const receipt = sealReceipt(recipientSelf, { identity: senderId, card: sender.card },
    readTransfer(sentTransfer.payload), { status: 'received', receivedAt: Date.now(), secretCount: 1 })
  const receiptLink = readProtocolLink(encodeReceiptLink(receipt))
  assert.equal(receiptLink.kind, 'receipt')

  const pairing = readProtocolLink(encodePairingLink(sender.card))
  assert.equal(pairing.kind, 'pairing')
  const connect = {
    format: 'sct-connect', version: 1, sessionId: randomUUID(), senderId, recipientId,
    createdAt: Date.now(), expiresAt: Date.now() + 60_000, ephemeralKey: 'synthetic-key',
    iv: randomBytes(12).toString('base64'), tag: randomBytes(16).toString('base64'),
    ciphertext: randomBytes(8).toString('base64'), signature: randomBytes(64).toString('base64')
  }
  const connectLink = `global-sct://connect/v1/${Buffer.from(JSON.stringify(connect)).toString('base64url')}`
  assert.equal(readProtocolLink(connectLink).kind, 'connect')
})

test('protocol reader rejects query strings, fragments, and oversized links', () => {
  const pairing = encodePairingLink(createIdentity('Synthetic device').card)
  assert.throws(() => readProtocolLink(`${pairing}?extra=1`), /invalid/)
  assert.throws(() => readProtocolLink(`${pairing}#fragment`), /invalid/)
  assert.throws(() => readProtocolLink(`global-sct://pair/v1/${'a'.repeat(linkLimit)}`), /exceeds 16,384/)
})
