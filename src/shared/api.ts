import type { Project, ProjectInput, ProjectRename } from './projects'
import type { SecretInput, SecretMetadata, SecretReference, SecretUpdate } from './secrets'
import type { SharingAPI } from './sharing'
import type { RelayAPI } from './relay'
import type { AgentAPI } from './agent'
import type { CardsAPI } from './cards'
import type { DirectAPI } from './direct'
import type { WebRtcAPI, WebRtcSessionConfig } from './webrtc'
import type { ShareAPI } from './share'
import type { UnlockInput, VaultStatus } from './vault'
import type { PendingLink } from './transport'

export type SctPlatform =
  | 'aix'
  | 'android'
  | 'cygwin'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'netbsd'
  | 'openbsd'
  | 'sunos'
  | 'win32'

// The user's choice. `system` follows the OS light or dark setting.
export type ThemePreference = 'light' | 'dark' | 'system'

// The variant on screen: Cream for light, Terminal for dark.
export type ThemeVariant = 'cream' | 'terminal'

export interface ProtocolStatus {
  supported: boolean
  registered: boolean
  owner: string | null
  conflict: boolean
  detail: string
}

export interface ChangePassphraseInput {
  currentPassphrase: string
  nextPassphrase: string
}

export interface SctAPI extends SharingAPI, RelayAPI, AgentAPI, CardsAPI, DirectAPI, WebRtcAPI, ShareAPI {
  platform: SctPlatform
  // The variant at window creation. onThemeChanged reports later changes.
  theme: ThemeVariant
  getThemePreference: () => Promise<ThemePreference>
  setThemePreference: (preference: ThemePreference) => Promise<ThemeVariant>
  onThemeChanged: (listener: (variant: ThemeVariant) => void) => () => void
  getProtocolStatus: () => Promise<ProtocolStatus>
  registerProtocol: (replace: boolean) => Promise<ProtocolStatus>
  removeProtocol: () => Promise<ProtocolStatus>
  getPendingLink: () => Promise<PendingLink | null>
  dismissPendingLink: (id: string) => Promise<void>
  onPendingLinkChanged: (listener: () => void) => () => void
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
  changePassphrase: (input: ChangePassphraseInput) => Promise<void>
  lockVault: () => Promise<VaultStatus>
  forgetDevice: () => Promise<VaultStatus>
}

type IpcCall<Method> = Method extends (...args: infer Args) => Promise<infer Result>
  ? { args: Args; result: Result }
  : never

type IpcEventArgs<Method> = Method extends (listener: (...args: infer Args) => void) => () => void ? Args : never

export type IpcChannels = {
  'sharing:create-link': IpcCall<SctAPI['createLink']>
  'sharing:preview-link': IpcCall<SctAPI['previewLink']>
  'sharing:import-link': IpcCall<SctAPI['importLink']>
  'sharing:verify-link-receipt': IpcCall<SctAPI['verifyLinkReceipt']>
  'sharing:link-state': IpcCall<SctAPI['getLinkState']>
  'sharing:copy-text': IpcCall<SctAPI['copyText']>
  'sharing:state': IpcCall<SctAPI['getSharingState']>
  'sharing:device-card': IpcCall<SctAPI['shareDeviceCard']>
  'sharing:copy-pairing-link': IpcCall<SctAPI['copyPairingLink']>
  'sharing:save-device-card': IpcCall<SctAPI['saveDeviceCard']>
  'sharing:preview-pairing-link': IpcCall<SctAPI['previewPairingLink']>
  'sharing:pick-peer': IpcCall<SctAPI['pickSharingPeer']>
  'sharing:confirm-peer': IpcCall<SctAPI['confirmSharingPeer']>
  'sharing:send': IpcCall<SctAPI['shareSecrets']>
  'sharing:pick-transfer': IpcCall<SctAPI['pickTransfer']>
  'sharing:import': IpcCall<SctAPI['importTransfer']>
  'sharing:dismiss': IpcCall<SctAPI['dismissTransfer']>
  'relay:state': IpcCall<SctAPI['getRelayState']>
  'relay:request-pair': IpcCall<SctAPI['requestRelayPair']>
  'relay:confirm-pair': IpcCall<SctAPI['confirmRelayPair']>
  'relay:remove-pair': IpcCall<SctAPI['removeRelayPair']>
  'relay:queue-transfer': IpcCall<SctAPI['queueRelayTransfer']>
  'relay:accept-transfer': IpcCall<SctAPI['acceptRelayTransfer']>
  'relay:queue-task': IpcCall<SctAPI['queueRelayTask']>
  'relay:respond-task': IpcCall<SctAPI['respondRelayTask']>
  'relay:hide-activity': IpcCall<SctAPI['hideRelayActivity']>
  'relay:hide-all-activity': IpcCall<SctAPI['hideAllRelayActivity']>
  'agent:requests': IpcCall<SctAPI['getAgentRequests']>
  'agent:respond': IpcCall<SctAPI['respondToAgent']>
  'cards:create': IpcCall<SctAPI['createMockCard']>
  'cards:share': IpcCall<SctAPI['shareMockCard']>
  'direct:state': IpcCall<SctAPI['getDirectState']>
  'direct:send': IpcCall<SctAPI['sendDirect']>
  'direct:import': IpcCall<SctAPI['importDirect']>
  'direct:verify-receipt': IpcCall<SctAPI['verifyDirectReceipt']>
  'webrtc:state': IpcCall<SctAPI['getWebRtcState']>
  'webrtc:ice': IpcCall<SctAPI['getWebRtcIce']>
  'webrtc:save-ice': IpcCall<SctAPI['saveWebRtcIce']>
  'webrtc:preview-link': IpcCall<SctAPI['previewWebRtcLink']>
  'webrtc:create-offer': IpcCall<SctAPI['createWebRtcOffer']>
  'webrtc:accept-offer': IpcCall<SctAPI['acceptWebRtcOffer']>
  'webrtc:accept-answer': IpcCall<SctAPI['acceptWebRtcAnswer']>
  'webrtc:close': IpcCall<SctAPI['closeWebRtc']>
  'webrtc:send': IpcCall<SctAPI['sendWebRtc']>
  'webrtc:import': IpcCall<SctAPI['importWebRtc']>
  'webrtc:verify-receipt': IpcCall<SctAPI['verifyWebRtcReceipt']>
  'share:current': IpcCall<SctAPI['getShareRequest']>
  'share:confirm': IpcCall<SctAPI['confirmShare']>
  'share:cancel': IpcCall<SctAPI['cancelShare']>
  'preferences:get-theme': IpcCall<SctAPI['getThemePreference']>
  'preferences:set-theme': IpcCall<SctAPI['setThemePreference']>
  'protocol:status': IpcCall<SctAPI['getProtocolStatus']>
  'protocol:register': IpcCall<SctAPI['registerProtocol']>
  'protocol:remove': IpcCall<SctAPI['removeProtocol']>
  'protocol:pending-link': IpcCall<SctAPI['getPendingLink']>
  'protocol:dismiss-link': IpcCall<SctAPI['dismissPendingLink']>
  'projects:list': IpcCall<SctAPI['listProjects']>
  'projects:pick-directory': IpcCall<SctAPI['pickDirectory']>
  'projects:add': IpcCall<SctAPI['addProject']>
  'projects:rename': IpcCall<SctAPI['renameProject']>
  'projects:delete': IpcCall<SctAPI['deleteProject']>
  'secrets:list': IpcCall<SctAPI['listSecrets']>
  'secrets:add': IpcCall<SctAPI['addSecret']>
  'secrets:update': IpcCall<SctAPI['updateSecret']>
  'secrets:delete': IpcCall<SctAPI['deleteSecret']>
  'vault:location': IpcCall<SctAPI['getVaultLocation']>
  'vault:choose-location': IpcCall<SctAPI['chooseVaultLocation']>
  'vault:status': IpcCall<SctAPI['getVaultStatus']>
  'vault:unlock': IpcCall<SctAPI['unlockVault']>
  'vault:change-passphrase': IpcCall<SctAPI['changePassphrase']>
  'vault:lock': IpcCall<SctAPI['lockVault']>
  'vault:forget': IpcCall<SctAPI['forgetDevice']>
}

export type IpcEvents = {
  'theme:changed': IpcEventArgs<SctAPI['onThemeChanged']>
  'protocol:pending-link': IpcEventArgs<SctAPI['onPendingLinkChanged']>
  'agent:changed': IpcEventArgs<SctAPI['onAgentChanged']>
  'share:changed': IpcEventArgs<SctAPI['onShareChanged']>
  'direct:changed': IpcEventArgs<SctAPI['onDirectChanged']>
  'webrtc:changed': IpcEventArgs<SctAPI['onWebRtcChanged']>
  'sharing:changed': IpcEventArgs<SctAPI['onSharingChanged']>
  'relay:changed': IpcEventArgs<SctAPI['onRelayChanged']>
  'webrtc:command': [command: WebRtcCommand]
  'webrtc:event': [value: unknown]
}

export type WebRtcCommand =
  | { type: 'offer'; config: WebRtcSessionConfig }
  | { type: 'accept-offer'; sdp: string; config: WebRtcSessionConfig }
  | { type: 'accept-answer'; sdp: string }
  | { type: 'send'; data: string }
  | { type: 'close' }

export type WebRtcEvent =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ready' }
  | { type: 'connected' }
  | { type: 'route'; route: 'direct' | 'turn' }
  | { type: 'message'; data: string }
  | { type: 'close' }
  | { type: 'error'; error: string }

export type Reply<T> = { ok: true; value: T } | { ok: false; error: string }
