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

export interface Receipt {
  id: string
  sender: string
  project: string
  names: string[]
}
