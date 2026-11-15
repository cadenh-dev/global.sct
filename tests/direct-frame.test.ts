import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FrameReader, encodeFrame, transferLimit, wrappedKeyLimit } from '../src/main/direct-frame.ts'

test('the frame reader accepts the documented maximum and rejects the next byte', () => {
  const reader = new FrameReader()
  const maximumBodyLength = 1 + 4 + transferLimit + wrappedKeyLimit
  const maximumHeader = Buffer.alloc(4)
  maximumHeader.writeUInt32BE(maximumBodyLength)
  assert.deepEqual(reader.push(maximumHeader), [])
  const oversizedHeader = Buffer.alloc(4)
  oversizedHeader.writeUInt32BE(maximumBodyLength + 1)
  assert.throws(() => new FrameReader().push(oversizedHeader), /frame is too large/)
})

test('the frame reader rejects a zero length frame', () => {
  assert.throws(() => new FrameReader().push(Buffer.alloc(4)), /frame is too large/)
})

test('the frame reader returns unknown kinds for the caller to reject', () => {
  const frames = new FrameReader().push(encodeFrame(255, Buffer.from('synthetic payload')))
  assert.equal(frames.length, 1)
  assert.equal(frames[0]?.kind, 255)
  assert.equal(frames[0]?.body.toString(), 'synthetic payload')
})
