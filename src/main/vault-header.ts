import { writeFileAtomic } from './atomic-write.ts'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import type { ScryptOptions } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod/v4'
import { open, seal } from './seal.ts'
import type { ScryptParams, SealedField, VaultHeader } from '../shared/vault.ts'

const scrypt = promisify(scryptCallback) as (password: Buffer, salt: Buffer, keyLength: number,
  options: ScryptOptions) => Promise<Buffer>

const verifierText = Buffer.from('sct-vault-v1')
const verifierData = Buffer.from('vault-verifier')
const wrappedKeyData = Buffer.from('vault-master-key')
const saltLength = 16
const ivLength = 12
const tagLength = 16
const maxMem = 256 * 1024 * 1024

// The defaults target about one second on a current laptop. The header stores them, so a later vault can raise the cost.
export const defaultScrypt: ScryptParams = { name: 'scrypt', n: 131072, r: 8, p: 1, keyLength: 32 }

const sealedSchema = z.object({ iv: z.string(), tag: z.string(), ciphertext: z.string() })
const kdfSchema = z.object({
  name: z.literal('scrypt'),
  n: z.number().int().min(2).max(1_048_576),
  r: z.number().int().min(1).max(32),
  p: z.number().int().min(1).max(16),
  keyLength: z.literal(32)
})
const headerSchema = z.discriminatedUnion('version', [
  z.object({
    version: z.literal(1),
    kdf: kdfSchema,
    salt: z.string(),
    verifier: sealedSchema
  }),
  z.object({
    version: z.literal(2),
    kdf: kdfSchema,
    salt: z.string(),
    verifier: sealedSchema,
    wrappedKey: sealedSchema
  })
])

export async function readVaultHeader(file: string): Promise<VaultHeader | null> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new Error('Cannot read the vault header. Check the storage permissions.', { cause: error })
  }
  const header = decodeHeader(text)
  if (!header) throw new Error('The vault header is damaged or has an unsupported version.')
  return header
}

export async function writeVaultHeader(file: string, header: VaultHeader): Promise<void> {
  try {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 })
    await writeFileAtomic(file, JSON.stringify(header, null, 2), 0o600)
  } catch (error) {
    throw new Error('Cannot save the vault header. Check the storage permissions.', { cause: error })
  }
}

export async function createVaultHeader(passphrase: string): Promise<{ header: VaultHeader; masterKey: Buffer }> {
  const salt = randomBytes(saltLength)
  const masterKey = randomBytes(32)
  try {
    return { header: await createWrappedVaultHeader(passphrase, masterKey, salt), masterKey }
  } catch (error) {
    masterKey.fill(0)
    throw error
  } finally {
    salt.fill(0)
  }
}

export async function createWrappedVaultHeader(passphrase: string, masterKey: Buffer,
  salt = randomBytes(saltLength)): Promise<VaultHeader> {
  try {
    const saltText = salt.toString('base64')
    const wrappingKey = await deriveMasterKey(passphrase, defaultScrypt, saltText)
    try {
      return {
        version: 2,
        kdf: defaultScrypt,
        salt: saltText,
        verifier: encodeSealed(seal(masterKey, verifierText, verifierData)),
        wrappedKey: encodeSealed(seal(wrappingKey, masterKey, wrappedKeyData))
      }
    } finally {
      wrappingKey.fill(0)
    }
  } finally {
    salt.fill(0)
  }
}

export async function openMasterKey(passphrase: string, header: VaultHeader): Promise<Buffer> {
  if (header.version === 1) return await deriveMasterKey(passphrase, header.kdf, header.salt)
  const wrappingKey = await deriveMasterKey(passphrase, header.kdf, header.salt)
  try {
    let opened: Buffer
    try {
      opened = open(wrappingKey, decodeSealed(header.wrappedKey), Buffer.from(wrappedKeyData))
    } catch {
      throw new Error('The passphrase is not correct. Try again.')
    }
    let keepOpened = false
    try {
      if (opened.length !== 32) throw new Error('The vault master key is invalid.')
      keepOpened = true
      return opened
    } finally {
      if (!keepOpened) opened.fill(0)
    }
  } finally {
    wrappingKey.fill(0)
  }
}

export async function deriveMasterKey(passphrase: string, kdf: ScryptParams, salt: string): Promise<Buffer> {
  const password = Buffer.from(passphrase, 'utf8')
  const saltBytes = Buffer.from(salt, 'base64')
  try {
    return await scrypt(password, saltBytes, kdf.keyLength, {
      N: kdf.n, r: kdf.r, p: kdf.p, maxmem: maxMem
    })
  } catch (error) {
    throw new Error('Cannot derive the vault key. The stored key settings are not usable.', { cause: error })
  } finally {
    password.fill(0)
    saltBytes.fill(0)
  }
}

export function verifyPassphrase(masterKey: Buffer, header: VaultHeader): boolean {
  let opened: Buffer | undefined
  try {
    opened = open(masterKey, decodeSealed(header.verifier), verifierData)
    return opened.length === verifierText.length && timingSafeEqual(opened, verifierText)
  } catch {
    return false
  } finally {
    opened?.fill(0)
  }
}

function decodeHeader(text: string): VaultHeader | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  const parsed = headerSchema.safeParse(value)
  if (!parsed.success) return undefined
  if (!isPowerOfTwo(parsed.data.kdf.n)) return undefined
  if (!isBase64(parsed.data.salt, saltLength)) return undefined
  if (!isBase64(parsed.data.verifier.iv, ivLength) || !isBase64(parsed.data.verifier.tag, tagLength)) return undefined
  if (!isBase64(parsed.data.verifier.ciphertext, verifierText.length)) return undefined
  if (parsed.data.version === 2 && (!isBase64(parsed.data.wrappedKey.iv, ivLength) ||
    !isBase64(parsed.data.wrappedKey.tag, tagLength) || !isBase64(parsed.data.wrappedKey.ciphertext, 32))) return undefined
  return parsed.data
}

// A crafted header could ask scrypt for a huge cost. The schema bounds each value; this check bounds the shape.
function isPowerOfTwo(value: number): boolean {
  return value > 1 && Number.isInteger(Math.log2(value))
}

function isBase64(value: string, length: number): boolean {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false
  const decoded = Buffer.from(value, 'base64')
  return decoded.length === length && decoded.toString('base64') === value
}

export function encodeSealed({ iv, tag, ciphertext }: { iv: Buffer; tag: Buffer; ciphertext: Buffer }): SealedField {
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), ciphertext: ciphertext.toString('base64') }
}

export function decodeSealed(field: SealedField): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  return {
    iv: Buffer.from(field.iv, 'base64'),
    tag: Buffer.from(field.tag, 'base64'),
    ciphertext: Buffer.from(field.ciphertext, 'base64')
  }
}
