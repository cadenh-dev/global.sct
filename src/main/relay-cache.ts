import { AsyncEntry } from '@napi-rs/keyring'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Vault } from './vault'
import { decodeFile, encodeFile, open, seal } from './seal'
import { writeFileAtomic } from './atomic-write'
import type { TaskRequest } from './relay-tasks'
import { isTaskRequest } from './relay-tasks'
import type { RelayPeer } from '../shared/relay'

export interface CachedPeer {
  pairId: string
  identity: string
  initiator: string
  name: string
  status: RelayPeer['status']
  encryptionPublicKey: string
  signingPublicKey: string
}

export interface CachedSentItem {
  messageId: string
  recipient: string
  status: 'Pending' | 'Received'
  deliverBy: string
  receivedAt: string | null
  receipt: string | null
}

export interface CachedInboxItem {
  messageId: string
  sender: string
  createdAt: string
  deliverBy: string
  payload: string
  wrappedKey: string
}

export interface CachedExpiryNotice {
  id: string
  correlationId: string
  sender: string
  notice: string
  createdAt: string
  retainUntil: string
}

// The cache keeps the relay rows of the last connection. Inbox payloads and wrapped keys stay ciphertext.
export interface Cache {
  identity: string | null
  updatedAt: string | null
  peers: CachedPeer[]
  inbox: CachedInboxItem[]
  sent: CachedSentItem[]
  expiryNotices: CachedExpiryNotice[]
}

export interface Pin {
  identity: string
  encryptionKey: string
  signingKey: string
}

export type SealedName = 'cache' | 'peers' | 'outbox' | 'received' | 'notices' | 'tasks' | 'results' | 'hidden'
const magic = Buffer.from('SCR1')

export class RelayCache {
  constructor(private readonly serverName: () => string, private readonly directory: string,
    private readonly vault: Vault, private readonly service: string) {}

  async read<T>(name: SealedName, empty: T): Promise<T> {
    try {
      const key = await this.key(name)
      try {
        const sealed = decodeFile(magic, await readFile(this.file(name)))
        if (!sealed) return empty
        // GCM authenticates the contents, so only this app can produce them.
        return JSON.parse(open(key, sealed, this.data(name)).toString('utf8')) as T
      } finally {
        key.fill(0)
      }
    } catch {
      return empty
    }
  }

  async write(name: SealedName, value: unknown): Promise<void> {
    const key = await this.key(name)
    try {
      // The app and agent sessions share this folder, so each write uses its own temporary file.
      await mkdir(this.directory, { recursive: true, mode: 0o700 })
      await writeFileAtomic(this.file(name), encodeFile(magic, seal(key, Buffer.from(JSON.stringify(value)), this.data(name))), 0o600)
    } finally {
      key.fill(0)
    }
  }

  async readToken(): Promise<string | undefined> {
    const saved = await this.vault.readInternal(this.tokenName())
    if (saved === null) return undefined
    try { return saved.toString('utf8') } finally { saved.fill(0) }
  }

  async readRequests(): Promise<TaskRequest[]> {
    let names: string[]
    try {
      names = await readdir(this.requestDirectory())
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    const key = await this.key('requests')
    try {
      const requests = await Promise.all(names.map(async (name): Promise<TaskRequest | null> => {
        const id = /^([0-9a-f-]{36})\.sct$/.exec(name)?.[1]
        if (!id) return null
        try {
          const sealed = decodeFile(magic, await readFile(join(this.requestDirectory(), name)))
          // The authenticated data contains the ID, so a renamed file does not open.
          const request: unknown = sealed && JSON.parse(open(key, sealed, this.requestData(id)).toString('utf8'))
          return isTaskRequest(request) && request.id === id ? request : null
        } catch {
          // A file that does not open did not come from this app. It cannot start a task.
          return null
        }
      }))
      return requests.filter((request): request is TaskRequest => request !== null)
    } finally {
      key.fill(0)
    }
  }

  async writeRequest(request: TaskRequest): Promise<void> {
    const file = join(this.requestDirectory(), `${request.id}.sct`)
    await mkdir(this.requestDirectory(), { recursive: true, mode: 0o700 })
    const key = await this.key('requests')
    try {
      await writeFileAtomic(file, encodeFile(magic, seal(key, Buffer.from(JSON.stringify(request)), this.requestData(request.id))), 0o600)
    } finally {
      key.fill(0)
    }
  }

  async key(name: SealedName | 'requests'): Promise<Buffer> {
    const internalName = `relay/cache/${name}/${createHash('sha256').update(this.serverName()).digest('hex')}`
    const saved = await this.vault.readInternal(internalName)
    if (saved) return saved
    return this.moveOldKey(name, internalName)
  }

  file(name: SealedName): string {
    // Each relay server has its own identity, so each server has its own files. A test server cannot replace the files of the live relay.
    return join(this.directory, `${name}-${createHash('sha256').update(this.serverName()).digest('hex').slice(0, 16)}.sct`)
  }

  data(name: SealedName): Buffer {
    return Buffer.from(`relay-${name}/${this.serverName()}`)
  }

  requestDirectory(): string {
    return join(this.directory, `requests-${createHash('sha256').update(this.serverName()).digest('hex').slice(0, 16)}`)
  }

  requestData(id: string): Buffer {
    return Buffer.from(`relay-request/${this.serverName()}/${id}`)
  }

  tokenName(): string {
    // The token name stays inside the internal-name grammar. The hash selects one token for each relay server.
    return `relay/token/${createHash('sha256').update(this.serverName()).digest('hex')}`
  }

  private async moveOldKey(name: SealedName | 'requests', internalName: string): Promise<Buffer> {
    let oldKey: number[] | null = null
    try { oldKey = await this.entry(`${name}/${this.serverName()}`).getSecret() } catch { /* The old OS item can be unavailable. */ }
    if (oldKey) {
      const key = Buffer.from(oldKey)
      let returnKey = false
      try {
        const existing = await this.vault.writeInternalIfAbsent(internalName, key)
        if (existing) {
          key.fill(0)
          try { await this.entry(`${name}/${this.serverName()}`).deletePassword() } catch { /* The vault copy is already durable. */ }
          return existing
        }
        try { await this.entry(`${name}/${this.serverName()}`).deletePassword() } catch { /* The vault copy is already durable. */ }
        returnKey = true
        return key
      } finally {
        oldKey.fill(0)
        if (!returnKey) key.fill(0)
      }
    }
    const key = randomBytes(32)
    try {
      const existing = await this.vault.writeInternalIfAbsent(internalName, key)
      if (existing) {
        key.fill(0)
        return existing
      }
      return key
    } catch (error) {
      key.fill(0)
      throw error
    }
  }

  private entry(account: string): AsyncEntry {
    return new AsyncEntry(this.service, account)
  }
}
