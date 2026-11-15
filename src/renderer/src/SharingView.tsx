import { useEffect, useRef, useState } from 'react'
import type { Project } from '../../shared/projects'
import type { SecretMetadata } from '../../shared/secrets'
import type { SharingState } from '../../shared/sharing'
import { errorText, StatusLine, useOperation } from './operation'
import type { Loaded, SharingTab, UpdateProjects, UpdateSecrets } from './types'
import type { PendingLink } from '../../shared/transport'
import { LinkSharing } from './LinkSharing'
import { DirectSharing } from './DirectSharing'
import { WebRtcSharing } from './WebRtcSharing'
import { DevicesTab } from './DevicesTab'
import { AirDropSendTab } from './AirDropSendTab'
import { AirDropReceiveTab } from './AirDropReceiveTab'
import { RelayTab } from './RelayTab'
import { SendTab } from './SendTab'
import { sharingRoute } from './sharingHelpers'
import type { Receipt } from './sharingHelpers'

interface SharingViewProps {
  projectId?: string
  tab?: SharingTab
  projects: Loaded<Project[]>
  secrets: Loaded<SecretMetadata[]>
  updateProjects: UpdateProjects
  updateSecrets: UpdateSecrets
  pendingLink: PendingLink | null
  onDismissPendingLink: (id: string) => void
}

type SharingValue = SharingState & { location: string }
type SharingOperation = ReturnType<typeof useOperation>
type SetSharing = (update: (current: Loaded<SharingValue>) => Loaded<SharingValue>) => void

interface ReadySharingProps {
  sharing: SharingValue
  activeTab: SharingTab
  projectId?: string
  projects: Loaded<Project[]>
  secrets: Loaded<SecretMetadata[]>
  receipt: Receipt | null
  setReceipt: (receipt: Receipt) => void
  operation: SharingOperation
  setSharing: SetSharing
  updateProjects: UpdateProjects
  updateSecrets: UpdateSecrets
  pendingLink: PendingLink | null
  onDismissPendingLink: (id: string) => void
}

export function SharingView({ projectId, tab, projects, secrets, updateProjects, updateSecrets,
  pendingLink, onDismissPendingLink }: SharingViewProps) {
  const [sharing, setSharing] = useState<Loaded<SharingState & { location: string }>>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const operation = useOperation()
  const isMac = window.sct.platform === 'darwin'
  const activeTab = activeSharingTab(sharing, receipt !== null, tab, isMac)

  useEffect(() => {
    let active = true
    const refresh = () => {
      Promise.all([window.sct.getSharingState(), window.sct.getVaultLocation()]).then(([value, location]) => {
        if (active) setSharing({ state: 'ready', value: { ...value, location } })
      }).catch((cause: unknown) => {
        if (active) setSharing({ state: 'error', error: errorText(cause, 'Cannot load sharing. Unlock the vault and retry.') })
      })
    }
    refresh()
    const unsubscribe = window.sct.onSharingChanged(refresh)
    return () => { active = false; unsubscribe() }
  }, [attempt])

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Sharing</h1>
          <p className="description">{isMac ? 'Send encrypted secrets by link, Direct, WebRTC, AirDrop, or Mailbox.' : 'Send encrypted secrets by link, Direct, WebRTC, or Mailbox.'} Received values stay in the main process.</p>
        </div>
      </div>

      <StatusLine status={operation.status} />
      {sharing.state === 'loading' && <p role="status">Loading sharing…</p>}
      {sharing.state === 'error' && <p className="error" role="alert">{sharing.error}</p>}
      {sharing.state === 'error' && <button type="button" className="secondary" onClick={() => {
        setSharing({ state: 'loading' })
        setAttempt((current) => current + 1)
      }}>Retry sharing</button>}
      {projects.state === 'error' && <p className="error" role="alert">{projects.error}</p>}
      {secrets.state === 'error' && <p className="error" role="alert">{secrets.error}</p>}

      {sharing.state === 'ready' && (isMac ? <MacSharing sharing={sharing.value} activeTab={activeTab} projectId={projectId}
        projects={projects} secrets={secrets} receipt={receipt} setReceipt={setReceipt} operation={operation}
        setSharing={setSharing} updateProjects={updateProjects} updateSecrets={updateSecrets}
        pendingLink={pendingLink} onDismissPendingLink={onDismissPendingLink} />
        : <RelayAndPairing sharing={sharing.value} setSharing={setSharing} activeTab={activeTab} projectId={projectId} projects={projects} secrets={secrets}
          operation={operation} updateProjects={updateProjects} updateSecrets={updateSecrets}
          pendingLink={pendingLink} onDismissPendingLink={onDismissPendingLink} />)}
      <div hidden={activeTab !== 'send'}>
        <SendTab projectId={projectId} active={activeTab === 'send'} projects={projects} secrets={secrets}
          busy={operation.busy} run={operation.run} />
      </div>
      {sharing.state === 'ready' && <div hidden={activeTab !== 'link'}>
        <LinkSharing projectId={projectId} active={activeTab === 'link'} projects={projects} secrets={secrets}
          peers={sharing.value.peers} busy={operation.busy} run={operation.run} updateSecrets={updateSecrets}
          pendingLink={pendingLink} onDismissPendingLink={onDismissPendingLink} />
      </div>}
      <div hidden={activeTab !== 'direct'}>
        <DirectSharing projectId={projectId} active={activeTab === 'direct'} projects={projects} secrets={secrets}
          updateSecrets={updateSecrets} busy={operation.busy} run={operation.run} />
      </div>
      <div hidden={activeTab !== 'webrtc'}>
        <WebRtcSharing projectId={projectId} active={activeTab === 'webrtc'} projects={projects} secrets={secrets}
          updateSecrets={updateSecrets} busy={operation.busy} run={operation.run}
          pendingLink={pendingLink} onDismissPendingLink={onDismissPendingLink} />
      </div>
    </>
  )
}

function MacSharing({ sharing, activeTab, projectId, projects, secrets, receipt, setReceipt, operation, setSharing,
  updateProjects, updateSecrets, pendingLink, onDismissPendingLink }: ReadySharingProps) {
  return (
    <>
      {activeTab !== 'receive' && sharing.incoming.length > 0 && <p className="sharing-waiting">
        <a href={sharingRoute('receive', projectId)}>
          {sharing.incoming.length === 1 ? 'A received transfer is waiting.' : `${sharing.incoming.length} received transfers are waiting.`}
        </a>
      </p>}
      <SharingTabs activeTab={activeTab} projectId={projectId} canShare={sharing.peers.length > 0} isMac />
      {sharing.peers.length > 0 && <div hidden={activeTab !== 'secrets'}>
        <AirDropSendTab projectId={projectId} active={activeTab === 'secrets'} projects={projects} secrets={secrets}
          peers={sharing.peers} busy={operation.busy} run={operation.run} />
      </div>}
      <div hidden={activeTab !== 'receive'}>
        <AirDropReceiveTab device={sharing.device} incoming={sharing.incoming} canImport={sharing.peers.length > 0}
          receipt={receipt} projects={projects} location={sharing.location} busy={operation.busy} run={operation.run}
          updateSecrets={updateSecrets} setReceipt={setReceipt}
          update={(incoming) => setSharing((current) => current.state === 'ready' ? {
            state: 'ready', value: { ...current.value, incoming: incoming(current.value.incoming) }
          } : current)} />
      </div>
      <div hidden={activeTab !== 'devices'}>
        <DevicesTab key={pendingLink?.kind === 'pairing' ? pendingLink.id : 'device-verification'}
          projectId={projectId} device={sharing.device} peers={sharing.peers}
          busy={operation.busy} run={operation.run} isMac
          initialLink={pendingLink?.kind === 'pairing' ? pendingLink.link : undefined}
          onDismissLink={pendingLink?.kind === 'pairing' ? () => onDismissPendingLink(pendingLink.id) : undefined}
          onVerified={(device) => setSharing((current) => current.state === 'ready' ? {
            state: 'ready', value: { ...current.value, peers: [...current.value.peers.filter((peer) => peer.id !== device.id), device] }
          } : current)} />
      </div>
      <div hidden={activeTab !== 'relay'}>
        <RelayTab projectId={projectId} active={activeTab === 'relay'} projects={projects} secrets={secrets}
          busy={operation.busy} run={operation.run} updateProjects={updateProjects} updateSecrets={updateSecrets} />
      </div>
    </>
  )
}

function RelayAndPairing({ sharing, setSharing, activeTab, projectId, projects, secrets, operation, updateProjects, updateSecrets,
  pendingLink, onDismissPendingLink }: Pick<ReadySharingProps,
  'sharing' | 'setSharing' | 'activeTab' | 'projectId' | 'projects' | 'secrets' | 'operation' | 'updateProjects' | 'updateSecrets' |
  'pendingLink' | 'onDismissPendingLink'>) {
  return (
    <>
      <SharingTabs activeTab={activeTab} projectId={projectId} canShare={false} isMac={false} />
      <div hidden={activeTab !== 'devices'}>
        <DevicesTab key={pendingLink?.kind === 'pairing' ? pendingLink.id : 'device-verification'}
          projectId={projectId} device={sharing.device} peers={sharing.peers}
          busy={operation.busy} run={operation.run} isMac={false}
          initialLink={pendingLink?.kind === 'pairing' ? pendingLink.link : undefined}
          onDismissLink={pendingLink?.kind === 'pairing' ? () => onDismissPendingLink(pendingLink.id) : undefined}
          onVerified={(device) => setSharing((current) => current.state === 'ready' ? {
            state: 'ready', value: { ...current.value, peers: [...current.value.peers.filter((peer) => peer.id !== device.id), device] }
          } : current)} />
      </div>
      <div hidden={activeTab !== 'relay'}>
        <RelayTab projectId={projectId} active={activeTab === 'relay'} projects={projects} secrets={secrets}
          busy={operation.busy} run={operation.run} updateProjects={updateProjects} updateSecrets={updateSecrets} />
      </div>
    </>
  )
}

// A waiting transfer or a new receipt opens the Receive tab unless the route names another tab.
function activeSharingTab(sharing: Loaded<SharingState>, received: boolean, tab: SharingTab | undefined, isMac: boolean): SharingTab {
  if (tab === 'link' || tab === 'direct' || tab === 'webrtc' || tab === 'send') return tab
  if (!isMac) return tab === 'devices' ? 'devices' : 'relay'
  if (tab === 'relay') return 'relay'
  if (tab === 'receive') return 'receive'
  if (sharing.state !== 'ready') return 'devices'
  if (!tab && (received || sharing.value.incoming.length > 0)) return 'receive'
  return sharing.value.peers.length > 0 ? tab ?? 'secrets' : 'devices'
}

function SharingTabs({ activeTab, projectId, canShare, isMac }: {
  activeTab: SharingTab
  projectId?: string
  canShare: boolean
  isMac: boolean
}) {
  const navigation = useRef<HTMLElement>(null)

  useEffect(() => {
    const showActiveTab = () => {
      const tabs = navigation.current
      const active = tabs?.querySelector<HTMLElement>('[aria-current="page"]')
      if (!tabs || !active) return
      if (active.offsetLeft < tabs.scrollLeft) tabs.scrollLeft = active.offsetLeft
      else if (active.offsetLeft + active.offsetWidth > tabs.scrollLeft + tabs.clientWidth) {
        tabs.scrollLeft = active.offsetLeft + active.offsetWidth - tabs.clientWidth
      }
    }
    showActiveTab()
    const observer = new ResizeObserver(showActiveTab)
    if (navigation.current) observer.observe(navigation.current)
    return () => observer.disconnect()
  }, [activeTab])

  return (
    <>
      <nav ref={navigation} className="sharing-tabs" aria-label="Sharing">
        <a href={sharingRoute('devices', projectId)} aria-current={activeTab === 'devices' ? 'page' : undefined}>Verify devices</a>
        <a href={sharingRoute('send', projectId)} aria-current={activeTab === 'send' ? 'page' : undefined}>Send</a>
        {isMac && (canShare ? (
          <a href={sharingRoute('secrets', projectId)} aria-current={activeTab === 'secrets' ? 'page' : undefined}>Send secrets</a>
        ) : <span aria-disabled="true" aria-describedby="sharing-verification-required">Send secrets</span>)}
        {isMac && <a href={sharingRoute('receive', projectId)} aria-current={activeTab === 'receive' ? 'page' : undefined}>Receive secrets</a>}
        <a href={sharingRoute('relay', projectId)} aria-current={activeTab === 'relay' ? 'page' : undefined}>Relay</a>
        <a href={sharingRoute('link', projectId)} aria-current={activeTab === 'link' ? 'page' : undefined}
          aria-label="Link sharing">Link</a>
        <a href={sharingRoute('direct', projectId)} aria-current={activeTab === 'direct' ? 'page' : undefined}
          aria-label="Direct sharing">Direct</a>
        <a href={sharingRoute('webrtc', projectId)} aria-current={activeTab === 'webrtc' ? 'page' : undefined}
          aria-label="WebRTC sharing">WebRTC</a>
      </nav>
      {isMac && !canShare && activeTab !== 'relay' && <p id="sharing-verification-required" className="field-help sharing-tab-help">
        Verify a device before you can send secrets.
      </p>}
    </>
  )
}
