import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { ChangePassphraseInput, IpcChannels, IpcEvents, Reply, SctAPI } from '../shared/api'
import type { ProjectInput, ProjectRename } from '../shared/projects'
import type { SecretInput, SecretReference, SecretUpdate } from '../shared/secrets'
import type { ConfirmRelayPairInput, RelayAcceptInput, RelayActivityKey, RelayQueueInput, RelayTaskDecision } from '../shared/relay'
import type { UnlockInput } from '../shared/vault'
import type { DirectReceiptInput, DirectSendInput } from '../shared/direct'
import type { WebRtcIceInput, WebRtcImportInput, WebRtcReceiptInput, WebRtcSendInput } from '../shared/webrtc'
import type { ShareConfirmInput } from '../shared/share'

async function invokeChannel<C extends keyof IpcChannels>(channel: C, ...args: IpcChannels[C]['args']): Promise<IpcChannels[C]['result']> {
  const reply: Reply<IpcChannels[C]['result']> = await ipcRenderer.invoke(channel, ...args)
  if (!reply.ok) throw new Error(reply.error)
  return reply.value
}

function onEvent<C extends keyof IpcEvents>(channel: C, listener: (...args: IpcEvents[C]) => void): () => void {
  const changed = (_event: IpcRendererEvent, ...args: IpcEvents[C]) => listener(...args)
  ipcRenderer.on(channel, changed)
  return () => { ipcRenderer.removeListener(channel, changed) }
}

const api: SctAPI = {
  platform: process.platform,
  // The main process adds this argument when it creates the window, so the first paint uses the correct variant.
  theme: process.argv.includes('--sct-theme=terminal') ? 'terminal' : 'cream',
  getThemePreference: () => invokeChannel('preferences:get-theme'),
  setThemePreference: (preference) => invokeChannel('preferences:set-theme', preference),
  onThemeChanged: (listener) => onEvent('theme:changed', (variant) => {
    if (variant === 'cream' || variant === 'terminal') listener(variant)
  }),
  getProtocolStatus: () => invokeChannel('protocol:status'),
  registerProtocol: (replace) => invokeChannel('protocol:register', replace),
  removeProtocol: () => invokeChannel('protocol:remove'),
  getPendingLink: () => invokeChannel('protocol:pending-link'),
  dismissPendingLink: (id) => invokeChannel('protocol:dismiss-link', id),
  onPendingLinkChanged: (listener) => onEvent('protocol:pending-link', listener),
  getAgentRequests: () => invokeChannel('agent:requests'),
  respondToAgent: (input) => invokeChannel('agent:respond', input),
  onAgentChanged: (listener) => onEvent('agent:changed', listener),
  listProjects: () => invokeChannel('projects:list'),
  pickDirectory: () => invokeChannel('projects:pick-directory'),
  addProject: (input: ProjectInput) => invokeChannel('projects:add', input),
  renameProject: (input: ProjectRename) => invokeChannel('projects:rename', input),
  deleteProject: (id: string) => invokeChannel('projects:delete', id),
  listSecrets: () => invokeChannel('secrets:list'),
  addSecret: (input: SecretInput) => invokeChannel('secrets:add', input),
  updateSecret: (input: SecretUpdate) => invokeChannel('secrets:update', input),
  deleteSecret: (input: SecretReference) => invokeChannel('secrets:delete', input),
  getVaultLocation: () => invokeChannel('vault:location'),
  chooseVaultLocation: () => invokeChannel('vault:choose-location'),
  getVaultStatus: () => invokeChannel('vault:status'),
  unlockVault: (input: UnlockInput) => invokeChannel('vault:unlock', input),
  changePassphrase: (input: ChangePassphraseInput) => invokeChannel('vault:change-passphrase', input),
  lockVault: () => invokeChannel('vault:lock'),
  forgetDevice: () => invokeChannel('vault:forget'),
  getShareRequest: () => invokeChannel('share:current'),
  confirmShare: (input: ShareConfirmInput) => invokeChannel('share:confirm', input),
  cancelShare: () => invokeChannel('share:cancel'),
  onShareChanged: (listener) => onEvent('share:changed', listener),
  getSharingState: () => invokeChannel('sharing:state'),
  createLink: (input) => invokeChannel('sharing:create-link', input),
  previewLink: (link) => invokeChannel('sharing:preview-link', link),
  importLink: (input) => invokeChannel('sharing:import-link', input),
  verifyLinkReceipt: (input) => invokeChannel('sharing:verify-link-receipt', input),
  getLinkState: () => invokeChannel('sharing:link-state'),
  copyText: (text) => invokeChannel('sharing:copy-text', text),
  getDirectState: () => invokeChannel('direct:state'),
  sendDirect: (input: DirectSendInput) => invokeChannel('direct:send', input),
  importDirect: (input) => invokeChannel('direct:import', input),
  verifyDirectReceipt: (input: DirectReceiptInput) => invokeChannel('direct:verify-receipt', input),
  onDirectChanged: (listener) => onEvent('direct:changed', listener),
  getWebRtcState: () => invokeChannel('webrtc:state'),
  getWebRtcIce: () => invokeChannel('webrtc:ice'),
  saveWebRtcIce: (input: WebRtcIceInput) => invokeChannel('webrtc:save-ice', input),
  previewWebRtcLink: (link: string) => invokeChannel('webrtc:preview-link', link),
  createWebRtcOffer: (peerId: string) => invokeChannel('webrtc:create-offer', peerId),
  acceptWebRtcOffer: (link: string) => invokeChannel('webrtc:accept-offer', link),
  acceptWebRtcAnswer: (link: string) => invokeChannel('webrtc:accept-answer', link),
  closeWebRtc: () => invokeChannel('webrtc:close'),
  sendWebRtc: (input: WebRtcSendInput) => invokeChannel('webrtc:send', input),
  importWebRtc: (input: WebRtcImportInput) => invokeChannel('webrtc:import', input),
  verifyWebRtcReceipt: (input: WebRtcReceiptInput) => invokeChannel('webrtc:verify-receipt', input),
  onWebRtcChanged: (listener) => onEvent('webrtc:changed', listener),
  shareDeviceCard: () => invokeChannel('sharing:device-card'),
  copyPairingLink: () => invokeChannel('sharing:copy-pairing-link'),
  saveDeviceCard: () => invokeChannel('sharing:save-device-card'),
  previewPairingLink: (link) => invokeChannel('sharing:preview-pairing-link', link),
  pickSharingPeer: () => invokeChannel('sharing:pick-peer'),
  confirmSharingPeer: (token) => invokeChannel('sharing:confirm-peer', token),
  shareSecrets: (input) => invokeChannel('sharing:send', input),
  pickTransfer: () => invokeChannel('sharing:pick-transfer'),
  importTransfer: (input) => invokeChannel('sharing:import', input),
  dismissTransfer: (id) => invokeChannel('sharing:dismiss', id),
  onSharingChanged: (listener) => onEvent('sharing:changed', listener),
  createMockCard: (input) => invokeChannel('cards:create', input),
  shareMockCard: (id) => invokeChannel('cards:share', id),
  getRelayState: () => invokeChannel('relay:state'),
  onRelayChanged: (listener) => onEvent('relay:changed', listener),
  requestRelayPair: (identity: string) => invokeChannel('relay:request-pair', identity),
  confirmRelayPair: (input: ConfirmRelayPairInput) => invokeChannel('relay:confirm-pair', input),
  removeRelayPair: (pairId: string) => invokeChannel('relay:remove-pair', pairId),
  queueRelayTransfer: (input: RelayQueueInput) => invokeChannel('relay:queue-transfer', input),
  acceptRelayTransfer: (input: RelayAcceptInput) => invokeChannel('relay:accept-transfer', input),
  queueRelayTask: (grantId: string) => invokeChannel('relay:queue-task', grantId),
  respondRelayTask: (input: RelayTaskDecision) => invokeChannel('relay:respond-task', input),
  hideRelayActivity: (input: RelayActivityKey) => invokeChannel('relay:hide-activity', input),
  hideAllRelayActivity: () => invokeChannel('relay:hide-all-activity')
}

contextBridge.exposeInMainWorld('sct', api)
