// One envelope and one receipt contract for every delivery mode (C8d).
// AirDrop is not a delivery mode, because macOS reports no delivery and a receipt is not possible.

export type DeliveryMode = 'direct' | 'mailbox' | 'link'
export type TransportName = 'hyperswarm' | 'webrtc' | 'relay' | 'link'

// One receipt shape for every mode. The recipient signs the receipt with its device key.
export interface TransferReceipt {
  transferId: string
  // The describeDevice ID of the device that signed the receipt.
  recipientDeviceId: string
  mode: DeliveryMode
  // Milliseconds since the Unix epoch, from the recipient clock.
  receivedAt: number
  // Base64. The signature covers the receipt routing fields and the ciphertext, not the mode.
  signature: string
}

export type ReceiptState =
  | { state: 'pending' }
  | { state: 'received'; receipt: TransferReceipt }
  // Link mode: the sender waits for a pasted sct://receipt link.
  | { state: 'manual' }
  | { state: 'expired' }
  | { state: 'failed'; error: string }

// One sent transfer to one recipient device.
export interface DeliveryRecord {
  transferId: string
  recipientDeviceId: string
  mode: DeliveryMode
  transport: TransportName
  state: ReceiptState
}

// The sender addresses the envelope by the device ID of a verified peer, so the input has no relay identity.
export interface EnvelopeTransferInput {
  projectId: string
  secretIds: string[]
  // The describeDevice ID of a verified peer in sharing/peers.json.
  recipientId: string
  // Milliseconds since the Unix epoch. The envelope rejects a deadline more than 7 days ahead.
  deliverBy: number
  accessExpiresAt: number | null
  injectionOnly: boolean
}
