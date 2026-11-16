import type { SecretMetadata } from '../../shared/secrets'
import type { Loaded, SharingTab } from './types'

export function selectedNames(secrets: Loaded<SecretMetadata[]>, selected: Set<string>): string[] {
  return secrets.state === 'ready' ? secrets.value.filter((secret) => selected.has(secret.id)).map((secret) => secret.name) : []
}

export function secretCount(count: number): string {
  return count === 1 ? '1 secret' : `${count} secrets`
}

export function sharingRoute(tab: SharingTab, projectId?: string): string {
  return `#/sharing/${tab}${projectId ? `/${encodeURIComponent(projectId)}` : ''}`
}

// The same help text shows below these fields on the Send, Link, and Relay forms.
export const accessExpiryHelp = 'After this time, the recipient cannot use the secrets in global.sct. Copies outside global.sct stay.'
export const injectionOnlyHelp = 'Injection passes the secrets to a command when it starts. The command can read the values.'

export interface Receipt {
  id: string
  sender: string
  project: string
  names: string[]
}
