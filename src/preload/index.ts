import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { Reply, SctAPI, ThemePreference, ThemeVariant } from '../shared/api'
import type { Project, ProjectInput, ProjectRename } from '../shared/projects'
import type { SecretInput, SecretMetadata, SecretReference, SecretUpdate } from '../shared/secrets'
import type { PairingPreview, SharingDevice, SharingState, TransferPreview } from '../shared/sharing'
import type { ConfirmRelayPairInput, RelayAcceptInput, RelayActivityKey, RelayQueueInput, RelayState, RelayTaskDecision } from '../shared/relay'
import type { AgentRequestView } from '../shared/agent'
import type { UnlockInput, VaultStatus } from '../shared/vault'
import type { LinkImportResult, LinkPreview, LinkRecord, LinkState, TransferReceipt } from '../shared/transport'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const reply: Reply<T> = await ipcRenderer.invoke(channel, ...args)
  if (!reply.ok) throw new Error(reply.error)
  return reply.value
}

const api: SctAPI = {
  platform: process.platform,
  // The main process adds this argument when it creates the window, so the first paint uses the correct variant.
  theme: process.argv.includes('--sct-theme=terminal') ? 'terminal' : 'cream',
  getThemePreference: () => invoke<ThemePreference>('preferences:get-theme'),
  setThemePreference: (preference) => invoke<ThemeVariant>('preferences:set-theme', preference),
  onThemeChanged: (listener) => {
    const changed = (_event: IpcRendererEvent, variant: unknown) => {
      if (variant === 'cream' || variant === 'terminal') listener(variant)
    }
    ipcRenderer.on('theme:changed', changed)
    return () => { ipcRenderer.removeListener('theme:changed', changed) }
  },
  getAgentRequests: () => invoke<AgentRequestView[]>('agent:requests'),
  respondToAgent: (input) => invoke<void>('agent:respond', input),
  onAgentChanged: (listener) => {
    const changed = () => listener()
    ipcRenderer.on('agent:changed', changed)
    return () => { ipcRenderer.removeListener('agent:changed', changed) }
  },
  listProjects: () => invoke<Project[]>('projects:list'),
  pickDirectory: () => invoke<string | null>('projects:pick-directory'),
  addProject: (input: ProjectInput) => invoke<Project>('projects:add', input),
  renameProject: (input: ProjectRename) => invoke<Project>('projects:rename', input),
  deleteProject: (id: string) => invoke<void>('projects:delete', id),
  listSecrets: () => invoke<SecretMetadata[]>('secrets:list'),
  addSecret: (input: SecretInput) => invoke<SecretMetadata>('secrets:add', input),
  updateSecret: (input: SecretUpdate) => invoke<SecretMetadata>('secrets:update', input),
  deleteSecret: (input: SecretReference) => invoke<void>('secrets:delete', input),
  getVaultLocation: () => invoke<string>('vault:location'),
  chooseVaultLocation: () => invoke<string | null>('vault:choose-location'),
  getVaultStatus: () => invoke<VaultStatus>('vault:status'),
  unlockVault: (input: UnlockInput) => invoke<VaultStatus>('vault:unlock', input),
  lockVault: () => invoke<VaultStatus>('vault:lock'),
  forgetDevice: () => invoke<VaultStatus>('vault:forget'),
  getSharingState: () => invoke<SharingState>('sharing:state'),
  createLink: (input) => invoke<LinkRecord>('sharing:create-link', input),
  previewLink: (link) => invoke<LinkPreview>('sharing:preview-link', link),
  importLink: (input) => invoke<LinkImportResult>('sharing:import-link', input),
  verifyLinkReceipt: (input) => invoke<TransferReceipt>('sharing:verify-link-receipt', input),
  getLinkState: () => invoke<LinkState>('sharing:link-state'),
  copyText: (text) => invoke<void>('sharing:copy-text', text),
  shareDeviceCard: () => invoke<void>('sharing:device-card'),
  copyPairingLink: () => invoke<void>('sharing:copy-pairing-link'),
  saveDeviceCard: () => invoke<boolean>('sharing:save-device-card'),
  previewPairingLink: (link) => invoke<PairingPreview>('sharing:preview-pairing-link', link),
  pickSharingPeer: () => invoke<PairingPreview | null>('sharing:pick-peer'),
  confirmSharingPeer: (token) => invoke<SharingDevice>('sharing:confirm-peer', token),
  shareSecrets: (input) => invoke<void>('sharing:send', input),
  pickTransfer: () => invoke<TransferPreview | null>('sharing:pick-transfer'),
  importTransfer: (input) => invoke<SecretMetadata[]>('sharing:import', input),
  dismissTransfer: (id) => invoke<void>('sharing:dismiss', id),
  onSharingChanged: (listener) => {
    const changed = () => listener()
    ipcRenderer.on('sharing:changed', changed)
    return () => { ipcRenderer.removeListener('sharing:changed', changed) }
  },
  createMockCard: (input) => invoke<string>('cards:create', input),
  shareMockCard: (id) => invoke<void>('cards:share', id),
  getRelayState: () => invoke<RelayState>('relay:state'),
  onRelayChanged: (listener) => {
    const changed = () => listener()
    ipcRenderer.on('relay:changed', changed)
    return () => { ipcRenderer.removeListener('relay:changed', changed) }
  },
  requestRelayPair: (identity: string) => invoke<void>('relay:request-pair', identity),
  confirmRelayPair: (input: ConfirmRelayPairInput) => invoke<void>('relay:confirm-pair', input),
  removeRelayPair: (pairId: string) => invoke<void>('relay:remove-pair', pairId),
  queueRelayTransfer: (input: RelayQueueInput) => invoke<string>('relay:queue-transfer', input),
  acceptRelayTransfer: (input: RelayAcceptInput) => invoke<SecretMetadata[]>('relay:accept-transfer', input),
  queueRelayTask: (grantId: string) => invoke<string>('relay:queue-task', grantId),
  respondRelayTask: (input: RelayTaskDecision) => invoke<void>('relay:respond-task', input),
  hideRelayActivity: (input: RelayActivityKey) => invoke<void>('relay:hide-activity', input),
  hideAllRelayActivity: () => invoke<void>('relay:hide-all-activity')
}

contextBridge.exposeInMainWorld('sct', api)
