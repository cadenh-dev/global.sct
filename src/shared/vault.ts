// The vault header holds no plaintext secret. Version 2 wraps the master key.
export type VaultHeader = VaultHeaderV1 | VaultHeaderV2

export interface VaultHeaderV1 {
  version: 1
  kdf: ScryptParams
  salt: string
  verifier: SealedField
}

export interface VaultHeaderV2 {
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
