import type { Project, ProjectInput, ProjectRename } from './projects'
import type { SecretInput, SecretMetadata, SecretReference, SecretUpdate } from './secrets'
import type { SharingAPI } from './sharing'
import type { RelayAPI } from './relay'
import type { AgentAPI } from './agent'
import type { CardsAPI } from './cards'
import type { UnlockInput, VaultStatus } from './vault'

export interface SctAPI extends SharingAPI, RelayAPI, AgentAPI, CardsAPI {
  listProjects: () => Promise<Project[]>
  pickDirectory: () => Promise<string | null>
  addProject: (input: ProjectInput) => Promise<Project>
  renameProject: (input: ProjectRename) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  listSecrets: () => Promise<SecretMetadata[]>
  addSecret: (input: SecretInput) => Promise<SecretMetadata>
  updateSecret: (input: SecretUpdate) => Promise<SecretMetadata>
  deleteSecret: (input: SecretReference) => Promise<void>
  getVaultLocation: () => Promise<string>
  chooseVaultLocation: () => Promise<string | null>
  getVaultStatus: () => Promise<VaultStatus>
  unlockVault: (input: UnlockInput) => Promise<VaultStatus>
  lockVault: () => Promise<VaultStatus>
  forgetDevice: () => Promise<VaultStatus>
}

export type Reply<T> = { ok: true; value: T } | { ok: false; error: string }
