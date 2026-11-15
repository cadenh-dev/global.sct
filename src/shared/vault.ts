// The vault header holds no plaintext secret. Version 2 wraps the master key.
export interface VaultHeader {
  version: 2
  kdf: ScryptParams
  salt: string
  verifier: SealedField
  wrappedKey: SealedField
}

export interface ScryptParams {
  name: 'scrypt'
  n: number
  r: number
  p: number
  keyLength: number
}

// A ciphertext with its IV and GCM tag. Every field is base64.
export interface SealedField {
  iv: string
  tag: string
  ciphertext: string
}

export type WrappedKey = SealedField

export interface VaultStatus {
  initialized: boolean
  locked: boolean
  rememberAvailable: boolean
  rememberEnabled: boolean
}

export interface UnlockInput {
  passphrase: string
  remember: boolean
}
