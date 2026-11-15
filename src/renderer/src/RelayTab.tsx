import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Project } from '../../shared/projects'
import type { SecretMetadata } from '../../shared/secrets'
import { relayInboxFinished, relaySentFinished, relayTaskFinished } from '../../shared/relay'
import type { RelayActivityKey, RelayInboxItem, RelayPeer, RelaySentItem, RelayState, RelayTaskDecision, RelayTaskItem } from '../../shared/relay'
import { errorText, StatusLine, useOperation } from './operation'
import { HandoffModal, Scramble } from './SharingMotion'
import { SecretSelection } from './SecretSelection'
import type { Loaded, Run, UpdateProjects, UpdateSecrets } from './types'
import { secretCount, selectedNames } from './sharingHelpers'

export function RelayTab({ projectId, active, projects, secrets, busy, run, updateProjects, updateSecrets }: {
  projectId?: string
  active: boolean
  projects: Loaded<Project[]>
  secrets: Loaded<SecretMetadata[]>
  busy: boolean
  run: Run
  updateProjects: UpdateProjects
  updateSecrets: UpdateSecrets
}) {
  const [relay, setRelay] = useState<Loaded<RelayState>>({ state: 'loading' })
  // Inbox rows that were present at the first load, or that already showed an arrival.
  const [seen, setSeen] = useState<Set<string> | null>(null)
  // The arrival that asks for a destination project after its animation.
  const [asking, setAsking] = useState<string | null>(null)
  const [imported, setImported] = useState<ImportedTransfer | null>(null)

  useEffect(() => {
    let mounted = true
    const refresh = () => {
      window.sct.getRelayState().then((value) => {
        if (!mounted) return
        setRelay({ state: 'ready', value })
        setSeen((current) => current ?? new Set(value.inbox.map((item) => item.messageId)))
      }).catch((cause: unknown) => {
        if (mounted) setRelay({ state: 'error', error: errorText(cause, 'Cannot read relay status.') })
      })
    }
    refresh()
    const unsubscribe = window.sct.onRelayChanged(refresh)
    return () => { mounted = false; unsubscribe() }
  }, [])

  if (relay.state === 'loading') return <p role="status">Loading relay…</p>
  if (relay.state === 'error') return <p className="error" role="alert">{relay.error}</p>
  // A dialog inside the hidden tab cannot show, so a new arrival waits until the Relay tab is open.
  const arrival = active && seen ? relay.value.inbox.find((item) => !seen.has(item.messageId)) : undefined
  const sender = arrival ? peerName(relay.value, arrival.sender) : ''
  // Only a transfer that this device can open and has not imported asks for a project.
  const destination = active ? relay.value.inbox.find((item) => item.messageId === asking && item.state === 'pending') : undefined
  return (
    <>
      {arrival && <HandoffModal key={arrival.messageId} heading={`Receiving from ${sender}`} via="relay" from={sender} to="This device"
        stage="received" object={{ shape: 'key', title: 'Encrypted transfer', detail: shortId(arrival.messageId) }}
        onDone={() => {
          setSeen((current) => new Set([...(current ?? []), arrival.messageId]))
          setAsking(arrival.messageId)
        }} />}
      {destination && projects.state === 'ready' && <RelayImportDialog key={destination.messageId} item={destination}
        sender={peerName(relay.value, destination.sender)} projects={projects.value} updateProjects={updateProjects}
        updateSecrets={updateSecrets} onClose={() => setAsking(null)} onImported={(value) => {
          setAsking(null)
          setImported(value)
        }} />}
      {imported && <HandoffModal heading={`Receiving from ${imported.sender}`} via="relay" from={imported.sender} to={imported.project}
        stage="arrived" onDone={() => setImported(null)} object={{
          shape: 'key',
          title: secretCount(imported.names.length),
          detail: imported.names.join(' ')
        }} />}
      <RelayConnection state={relay.value} />
      <RelayPairing state={relay.value} busy={busy} run={run} />
      <RelaySend projectId={projectId} projects={projects} secrets={secrets} state={relay.value} busy={busy} run={run} />
      <RelayActivity state={relay.value} projects={projects} busy={busy} run={run} updateProjects={updateProjects}
        updateSecrets={updateSecrets} onImported={setImported} />
    </>
  )
}

interface ImportedTransfer {
  sender: string
  project: string
  names: string[]
}

// After the arrival animation, the recipient chooses a project or makes one. The import sends the receipt,
// so the sender shows the transfer as sent until the recipient imports it.
function RelayImportDialog({ item, sender, projects, updateProjects, updateSecrets, onClose, onImported }: {
  item: RelayInboxItem
  sender: string
  projects: Project[]
  updateProjects: UpdateProjects
  updateSecrets: UpdateSecrets
  onClose: () => void
  onImported: (imported: ImportedTransfer) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const operation = useOperation()

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  return (
    <dialog ref={dialog} className="import-dialog" aria-labelledby="import-heading"
      onCancel={(event) => { if (operation.busy) event.preventDefault() }} onClose={onClose}>
      <h2 id="import-heading">Save secrets from {sender}</h2>
      <p>{item.projectName}: {item.secretNames.join(', ')}</p>
      <p className="field-help">Choose a project on this device or make a new one. The transfer stays pending until you import it.</p>
      <StatusLine status={operation.status} />
      <RelayImportForm item={item} sender={sender} projects={projects} busy={operation.busy} run={operation.run}
        updateProjects={updateProjects} updateSecrets={updateSecrets} onImported={onImported}
        onLater={() => dialog.current?.close()} />
    </dialog>
  )
}

function RelayConnection({ state }: { state: RelayState }) {
  const live = state.connection === 'connected'
  return (
    <section className="relay-summary" aria-labelledby="relay-heading">
      <div>
        <h2 id="relay-heading">Relay sharing</h2>
        <p>{relayConnectionText(state)}</p>
      </div>
      <p className="relay-state" data-state={state.connection}>{live ? 'Live status' : 'Cached status'}</p>
      {state.identity && <div className="relay-identity">
        <span>This device’s relay ID</span>
        <code>{state.identity}</code>
      </div>}
      {!live && state.updatedAt && <p className="field-help">Last relay update: {formatTime(state.updatedAt)}.</p>}
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </section>
  )
}

function relayConnectionText(state: RelayState): string {
  if (state.connection === 'connected') return state.registered
    ? 'This device is connected. Relay updates appear without a page reload.'
    : 'This device is connected but is not registered yet.'
  if (state.connection === 'connecting') return 'This device is connecting. Saved activity remains available.'
  if (state.connection === 'offline') return 'The relay is offline. Saved activity can be out of date.'
  return 'The relay is off. Set SCT_RELAY to connect this app.'
}

function RelayPairing({ state, busy, run }: { state: RelayState; busy: boolean; run: Run }) {
  const [identity, setIdentity] = useState('')
  const [compared, setCompared] = useState<Set<string>>(() => new Set())

  async function requestPair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run('Sending the relay pairing request…', async () => {
      await window.sct.requestRelayPair(identity)
      setIdentity('')
      return 'The relay pairing request was sent.'
    })
  }

  return (
    <section className="panel" aria-labelledby="relay-pair-heading">
      <h2 id="relay-pair-heading">Pair relay devices</h2>
      <p>Enter the relay ID from the other device. Compare the code on both screens before confirmation.</p>
      <form onSubmit={(event) => { void requestPair(event) }}>
        <fieldset disabled={busy || state.connection !== 'connected'}>
          <label htmlFor="relay-peer-identity">Other device’s relay ID</label>
          <input id="relay-peer-identity" name="relayPeerIdentity" autoComplete="off" spellCheck="false"
            value={identity} minLength={64} maxLength={64} pattern="[0-9a-f]{64}" required
            onChange={(event) => setIdentity(event.target.value.trim().toLowerCase())} />
          <div className="form-actions">
            <button type="submit" disabled={busy || identity.length !== 64}>Request pairing</button>
          </div>
        </fieldset>
      </form>
      {state.peers.length === 0 ? <p className="field-help">No relay devices are paired.</p> : (
        <ul className="relay-peers" aria-label="Relay devices">
          {state.peers.map((peer) => <li key={peer.pairId}>
            <div className="relay-peer-heading">
              <div><h3>{peer.name}</h3><p>{relayPeerState(peer)}</p></div>
              <button type="button" className="secondary" disabled={busy} onClick={() => {
                void run('Removing the relay pair…', async () => {
                  await window.sct.removeRelayPair(peer.pairId)
                  return `${peer.name} was removed from relay sharing.`
                })
              }}>Remove</button>
            </div>
            {/* Saved keys can outlive a relay pair, so both devices show the code again while the pair is pending. */}
            {peer.code && (peer.trust !== 'verified' || peer.status === 'Pending') && <div className="relay-code">
              <p aria-label={`Pairing code for ${peer.name}`}>{peer.code}</p>
              <label className="check-field">
                <input type="checkbox" checked={compared.has(peer.pairId)} onChange={(event) => setCompared((current) => {
                  const next = new Set(current)
                  if (event.target.checked) next.add(peer.pairId)
                  else next.delete(peer.pairId)
                  return next
                })} />
                I compared this code on both devices
              </label>
              <button type="button" disabled={busy || !compared.has(peer.pairId)} onClick={() => {
                void run('Saving the verified relay device…', async () => {
                  await window.sct.confirmRelayPair({ pairId: peer.pairId, code: peer.code ?? '' })
                  return `${peer.name} is verified for relay sharing.`
                })
              }}>Confirm relay device</button>
            </div>}
          </li>)}
        </ul>
      )}
    </section>
  )
}

function relayPeerState(peer: RelayPeer): string {
  if (peer.trust === 'changed') return 'Keys changed. Compare a new code before sharing.'
  if (peer.trust === 'invalid') return 'The device keys are invalid.'
  if (peer.trust === 'verified' && peer.status === 'Verified') return 'Verified recipient'
  return peer.requestedByMe ? 'Waiting for the other device' : 'Pairing request received'
}

function RelaySend({ projectId, projects, secrets, state, busy, run }: {
  projectId?: string
  projects: Loaded<Project[]>
  secrets: Loaded<SecretMetadata[]>
  state: RelayState
  busy: boolean
  run: Run
}) {
  const recipients = state.peers.filter((peer) => peer.status === 'Verified' && peer.trust === 'verified')
  const [source, setSource] = useState(projectId ?? '')
  const [recipient, setRecipient] = useState(recipients.length === 1 ? recipients[0]?.identity ?? '' : '')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [accessExpiresAt, setAccessExpiresAt] = useState('')
  const [injectionOnly, setInjectionOnly] = useState(true)
  const [handoff, setHandoff] = useState<RelayHandoffState | null>(null)

  async function queue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const sent = {
      recipient: recipients.find((peer) => peer.identity === recipient)?.name ?? 'the recipient',
      names: selectedNames(secrets, selected)
    }
    setHandoff({ stage: 'prepare', messageId: '', ...sent })
    const queued = await run('Encrypting and saving the relay transfer…', async () => {
      const messageId = await window.sct.queueRelayTransfer({
        projectId: source,
        secretIds: [...selected],
        recipient,
        accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt).getTime() : null,
        injectionOnly
      })
      setHandoff({ stage: 'wait', messageId, ...sent })
      setSelected(new Set())
      return 'The encrypted transfer is queued on this device.'
    })
    if (!queued) setHandoff(null)
  }

  return (
    <section className="panel" aria-labelledby="relay-send-heading">
      <h2 id="relay-send-heading">Queue a relay transfer</h2>
      {handoff && <RelayHandoff handoff={handoff} sent={state.sent} onDone={() => setHandoff(null)} />}
      {recipients.length === 0 && <p>Verify a relay device before you queue secrets.</p>}
      {projects.state === 'ready' && projects.value.length === 0 && <p><a href="#/">Add a project</a> to store and share secrets.</p>}
      {recipients.length > 0 && projects.state === 'ready' && projects.value.length > 0 && <form onSubmit={(event) => { void queue(event) }}>
        <fieldset disabled={busy}>
          <label htmlFor="relay-project">Source project</label>
          <select id="relay-project" value={source} required onChange={(event) => {
            setSource(event.target.value)
            setSelected(new Set())
          }}>
            <option value="">Choose a project</option>
            {projects.value.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <label htmlFor="relay-recipient">Verified relay recipient</label>
          <select id="relay-recipient" value={recipient} required onChange={(event) => setRecipient(event.target.value)}>
            <option value="">Choose a verified device</option>
            {recipients.map((peer) => <option key={peer.identity} value={peer.identity}>{peer.name}</option>)}
          </select>
          <SecretSelection secrets={secrets} source={source} selected={selected} onChange={setSelected} />
          <label htmlFor="relay-access-expires">Access expires (optional)</label>
          <input id="relay-access-expires" name="accessExpiresAt" type="datetime-local" value={accessExpiresAt}
            onChange={(event) => setAccessExpiresAt(event.target.value)} />
          <label className="check-field">
            <input type="checkbox" checked={injectionOnly} onChange={(event) => setInjectionOnly(event.target.checked)} />
            Allow command injection only. Block reveal, copy, and reshare.
          </label>
          <p className="field-help">Queued transfers stay encrypted on this device. Secret values never enter this screen.</p>
          <div className="form-actions">
            <button type="submit" disabled={busy || !source || !recipient || selected.size === 0}>Queue encrypted transfer</button>
          </div>
        </fieldset>
      </form>}
    </section>
  )
}

interface RelayHandoffState {
  stage: 'prepare' | 'wait'
  messageId: string
  recipient: string
  names: string[]
}

// The relay state drives the last stage. A failed or expired transfer closes the modal, and the activity table shows why.
function RelayHandoff({ handoff, sent, onDone }: { handoff: RelayHandoffState; sent: RelaySentItem[]; onDone: () => void }) {
  const delivery = sent.find((item) => item.messageId === handoff.messageId)?.state
  if (delivery === 'failed' || delivery === 'expired') return null
  return (
    <HandoffModal heading={`Sending secrets to ${handoff.recipient}`} via="relay" from="This device" to={handoff.recipient}
      stage={delivery === 'received' ? 'delivered' : handoff.stage} onDone={onDone} object={{
        shape: 'key',
        title: secretCount(handoff.names.length),
        detail: <Scramble text={handoff.names.join(' ')} mode="encrypt" />
      }} />
  )
}

function RelayActivity({ state, projects, busy, run, updateProjects, updateSecrets, onImported }: {
  state: RelayState
  projects: Loaded<Project[]>
  busy: boolean
  run: Run
  updateProjects: UpdateProjects
  updateSecrets: UpdateSecrets
  onImported: (imported: ImportedTransfer) => void
}) {
  const cached = state.connection !== 'connected'
  const empty = state.sent.length === 0 && state.inbox.length === 0 && state.tasks.length === 0
  return (
    <section className="relay-activity" aria-labelledby="relay-activity-heading">
      <div className="group-heading">
        <h2 id="relay-activity-heading">Delivery activity</h2>
        {cached && <span>Cached status</span>}
        {!empty && <button type="button" className="secondary" disabled={busy} onClick={() => {
          void run('Deleting all activity…', async () => {
            await window.sct.hideAllRelayActivity()
            return 'All activity was deleted from this list. A row that changes state shows again.'
          })
        }}>Delete all</button>}
      </div>
      {empty ? (
        <div className="empty-state compact"><p>No relay delivery activity is saved on this device.</p></div>
      ) : <>
        {state.sent.length > 0 && <table>
          <caption>Sent transfers</caption>
          <thead><tr><th scope="col">Transfer</th><th scope="col">Recipient</th><th scope="col">Delivery</th>
            <th scope="col">Receipt</th><th scope="col">Delivery deadline</th><th scope="col">Recipient access</th><th scope="col">Remote demo</th>
            <th scope="col"><span className="sr-only">Delete</span></th></tr></thead>
          <tbody>{state.sent.map((item) => <RelayActivityRow key={`${item.messageId}/${item.recipient}`} item={item} state={state}
            busy={busy} run={run} />)}</tbody>
        </table>}
        {state.tasks.length > 0 && <div className="relay-inbox">
          <h3>Remote demo runs</h3>
          <ul>{state.tasks.map((task) => <RelayTask key={`${task.direction}/${task.messageId}`} task={task} state={state} busy={busy} run={run} />)}</ul>
        </div>}
        {state.inbox.length > 0 && <div className="relay-inbox">
          <h3>Received transfers</h3>
          <ul>{state.inbox.map((item) => <RelayInboxTransfer key={item.messageId} item={item} state={state}
            projects={projects} busy={busy} run={run} updateProjects={updateProjects} updateSecrets={updateSecrets}
            onImported={onImported} />)}</ul>
        </div>}
      </>}
    </section>
  )
}

function RelayInboxTransfer({ item, state, projects, busy, run, updateProjects, updateSecrets, onImported }: {
  item: RelayInboxItem
  state: RelayState
  projects: Loaded<Project[]>
  busy: boolean
  run: Run
  updateProjects: UpdateProjects
  updateSecrets: UpdateSecrets
  onImported: (imported: ImportedTransfer) => void
}) {
  const sender = peerName(state, item.sender)
  return <li>
    <div className="relay-inbox-heading">
      <div>
        <h4>{item.projectName ?? 'Unreadable transfer'}</h4>
        <p>From {sender}. Transfer <code>{shortId(item.messageId)}</code>.</p>
      </div>
      <span className="delivery-state" data-state={item.state}>{item.state}</span>
    </div>
    {item.secretNames.length > 0 && <p>{item.secretNames.join(', ')}</p>}
    <p className="field-help">Deliver before {formatTime(item.deliverBy)}. {grantText(item)}</p>
    {item.error && <p className="error" role="alert">{item.error}</p>}
    <RelayInboxAction item={item} sender={sender} projects={projects} busy={busy} run={run} updateProjects={updateProjects}
      updateSecrets={updateSecrets} onImported={onImported} />
    {relayInboxFinished(item) && <div className="form-actions">
      <DeleteActivity activity={{ kind: 'inbox', messageId: item.messageId, peer: item.sender }}
        label={`Delete transfer ${shortId(item.messageId)}`} busy={busy} run={run} />
    </div>}
  </li>
}

function RelayInboxAction({ item, sender, projects, busy, run, updateProjects, updateSecrets, onImported }: {
  item: RelayInboxItem
  sender: string
  projects: Loaded<Project[]>
  busy: boolean
  run: Run
  updateProjects: UpdateProjects
  updateSecrets: UpdateSecrets
  onImported: (imported: ImportedTransfer) => void
}) {
  if (item.state === 'received' && item.receivedAt) return <p className="field-help">
    Imported {formatTime(item.receivedAt)}. The receipt confirms durable delivery.
  </p>
  if (item.state !== 'pending' || projects.state !== 'ready') return null
  return <RelayImportForm item={item} sender={sender} projects={projects.value} busy={busy} run={run} updateProjects={updateProjects}
    updateSecrets={updateSecrets} onImported={onImported} />
}

// Project IDs are UUIDs, so this select value cannot match a project.
const newProject = 'new'

function RelayImportForm({ item, sender, projects, busy, run, updateProjects, updateSecrets, onImported, onLater }: {
  item: RelayInboxItem
  sender: string
  projects: Project[]
  busy: boolean
  run: Run
  updateProjects: UpdateProjects
  updateSecrets: UpdateSecrets
  onImported: (imported: ImportedTransfer) => void
  onLater?: () => void
}) {
  const [destination, setDestination] = useState(item.destinationProjectId
    ?? (projects.length === 0 ? newProject : projects.length === 1 ? projects[0]?.id ?? '' : ''))
  const [name, setName] = useState(item.projectName ?? '')
  const [directory, setDirectory] = useState('')
  const creating = destination === newProject

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run('Verifying and importing the relay transfer…', async () => {
      const project = creating ? await addProject() : projects.find((saved) => saved.id === destination)
      if (!project) throw new Error('Choose a destination project.')
      const saved = await window.sct.acceptRelayTransfer({ messageId: item.messageId, projectId: project.id })
      updateSecrets((current) => [...current.filter((secret) => !saved.some((added) => added.id === secret.id)), ...saved])
      onImported({ sender, project: project.name, names: saved.map((secret) => secret.name) })
      return `Imported ${saved.length} ${saved.length === 1 ? 'secret' : 'secrets'}. The encrypted receipt is saved.`
    })
  }

  // A failed import keeps the new project selected, so a retry does not add the project again.
  async function addProject(): Promise<Project> {
    const project = await window.sct.addProject({ name, directory })
    updateProjects((current) => [...current, project])
    setDestination(project.id)
    return project
  }

  async function browse() {
    await run('Opening the folder picker…', async () => {
      const selected = await window.sct.pickDirectory()
      if (!selected) return ''
      setDirectory(selected)
      if (!name.trim()) setName(selected.split('/').filter(Boolean).at(-1) ?? 'Project')
      return ''
    })
  }

  return <form onSubmit={(event) => { void accept(event) }}>
      <fieldset disabled={busy}>
        <label htmlFor={`relay-destination-${item.messageId}`}>Destination project</label>
        <select id={`relay-destination-${item.messageId}`} value={destination} required
          onChange={(event) => setDestination(event.target.value)}>
          <option value="">Choose a project</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          <option value={newProject}>New project</option>
        </select>
        {creating && <>
          <label htmlFor={`relay-project-name-${item.messageId}`}>Project name</label>
          <input id={`relay-project-name-${item.messageId}`} value={name} maxLength={100} required placeholder="My project"
            onChange={(event) => setName(event.target.value)} />
          <label htmlFor={`relay-project-directory-${item.messageId}`}>Folder path</label>
          <div className="folder-field">
            <input id={`relay-project-directory-${item.messageId}`} value={directory} maxLength={4096} required
              placeholder="/Users/you/projects/my-project" onChange={(event) => setDirectory(event.target.value)} />
            <button type="button" className="secondary" onClick={() => { void browse() }}>Choose folder…</button>
          </div>
        </>}
        <div className="form-actions">
          {onLater && <button type="button" className="secondary" onClick={onLater}>Later</button>}
          <button type="submit" disabled={busy || !destination || (creating && (!name.trim() || !directory.trim()))}>
            Import and send receipt
          </button>
        </div>
      </fieldset>
    </form>
}

// Deletes a finished row from this list only. The local record stays, so duplicate checks and grants still work.
function DeleteActivity({ activity, label, busy, run }: { activity: RelayActivityKey; label: string; busy: boolean; run: Run }) {
  return <button type="button" className="secondary" aria-label={label} disabled={busy} onClick={() => {
    void run('Deleting the activity…', async () => {
      await window.sct.hideRelayActivity(activity)
      return 'The activity was deleted from this list.'
    })
  }}>Delete</button>
}

function grantText(item: RelayInboxItem): string {
  const use = item.injectionOnly ? 'Injection only.' : 'Resharing is allowed.'
  return item.accessExpiresAt ? `${use} Access expires ${formatTime(item.accessExpiresAt)}.` : `${use} Access does not expire.`
}

// The recipient approves or refuses on its own device. Only this window can send that decision.
function RelayTask({ task, state, busy, run }: { task: RelayTaskItem; state: RelayState; busy: boolean; run: Run }) {
  const peer = peerName(state, task.peer)
  const decide = (decision: RelayTaskDecision['decision'], pending: string, done: string) => {
    if (!task.digest) return
    const input = { messageId: task.messageId, digest: task.digest, decision }
    void run(pending, async () => {
      await window.sct.respondRelayTask(input)
      return done
    })
  }
  return <li>
    <div className="relay-inbox-heading">
      <div>
        <h4>{task.direction === 'sent' ? `Fixed demo on ${peer}` : `${peer} asks to run the fixed demo`}</h4>
        <p>Task <code>{shortId(task.messageId)}</code> with grant <code>{task.grantId ? shortId(task.grantId) : 'unknown'}</code>.</p>
      </div>
      <span className="delivery-state" data-state={task.state}>{task.state.replace('-', ' ')}</span>
    </div>
    {task.projectName && <p>{task.projectName}: {task.secretNames.join(', ')}</p>}
    <p className="field-help">{relayTaskText(task)}</p>
    {task.error && <p className="error" role="alert">{task.error}</p>}
    {task.direction === 'received' && task.state === 'awaiting-approval' && <div className="form-actions">
      <button type="button" className="secondary" disabled={busy}
        onClick={() => decide('refuse', 'Refusing the task…', 'The task was refused. global.sct sends the refusal.')}>Refuse</button>
      <button type="button" disabled={busy}
        onClick={() => decide('approve', 'Running the fixed demo…', 'The run finished. global.sct sends the result.')}>Approve once</button>
    </div>}
    {task.reviewRequired && <>
      <p>The app stopped during this run. global.sct cannot know whether the demo finished. It does not run this task again.</p>
      <div className="form-actions">
        <button type="button" disabled={busy}
          onClick={() => decide('report', 'Saving the review…', 'The uncertain result is queued for the sender.')}>Send uncertain result</button>
      </div>
    </>}
    {relayTaskFinished(task) && <div className="form-actions">
      <DeleteActivity activity={{ kind: 'task', messageId: task.messageId, peer: task.peer }}
        label={`Delete task ${shortId(task.messageId)}`} busy={busy} run={run} />
    </div>}
  </li>
}

function relayTaskText(task: RelayTaskItem): string {
  const outcome = task.exitCode === null ? '' : ` Exit code ${task.exitCode}. SCT_DEMO_TOKEN ${task.secretPresent ? 'was' : 'was not'} present.`
  if (task.direction === 'sent') {
    if (task.state === 'delivered') return `The other device saved the task. Approval is due by ${formatTime(task.approveBy)}.`
    return task.finishedAt ? `Result from ${formatTime(task.finishedAt)}.${outcome}` : `Approval is due by ${formatTime(task.approveBy)}.`
  }
  if (task.state === 'awaiting-approval') return `Approve by ${formatTime(task.approveBy)}. The run injects only these grant secrets and returns no output.`
  const reply = task.reply === 'none' ? 'The result is not queued.' : `Result delivery: ${task.reply}.`
  return task.finishedAt ? `Finished ${formatTime(task.finishedAt)}.${outcome} ${reply}` : reply
}

function RelayActivityRow({ item, state, busy, run }: { item: RelaySentItem; state: RelayState; busy: boolean; run: Run }) {
  const usable = item.state === 'received' && !item.accessExpiredAt && (!item.accessExpiresAt || Date.parse(item.accessExpiresAt) > Date.now())
  return <tr>
    <td><code>{shortId(item.messageId)}</code></td>
    <td>{peerName(state, item.recipient)}</td>
    <td>
      <span className="delivery-state" data-state={item.state}>{item.state}</span>
      {item.error && <span className="delivery-error">{item.error}</span>}
    </td>
    <td>{relayReceiptText(item)}</td>
    <td>{item.deliverBy ? formatTime(item.deliverBy) : 'Not cached'}</td>
    <td>{relayAccessText(item)}</td>
    <td>{usable ? <button type="button" className="secondary" disabled={busy || state.connection !== 'connected'} onClick={() => {
      void run('Encrypting and saving the task…', async () => {
        await window.sct.queueRelayTask(item.messageId)
        return `The task is queued. ${peerName(state, item.recipient)} must approve it on that device.`
      })
    }}>Request run</button> : 'Not available'}</td>
    <td>{relaySentFinished(item) && <DeleteActivity activity={{ kind: 'sent', messageId: item.messageId, peer: item.recipient }}
      label={`Delete transfer ${shortId(item.messageId)}`} busy={busy} run={run} />}</td>
  </tr>
}

function relayReceiptText(item: RelaySentItem): string {
  if (item.receiptState.state === 'received') return 'Verified'
  if (item.receiptState.state === 'pending') return 'Waiting'
  if (item.receiptState.state === 'expired') return 'Expired'
  return 'Failed'
}

function relayAccessText(item: RelaySentItem): string {
  if (item.accessExpiredAt) return `Expired and removed ${formatTime(item.accessExpiredAt)}`
  if (!item.accessExpiresAt) return 'Does not expire'
  return Date.parse(item.accessExpiresAt) <= Date.now()
    ? `Expired ${formatTime(item.accessExpiresAt)}. Waiting for cleanup notice.`
    : `Expires ${formatTime(item.accessExpiresAt)}`
}

function peerName(state: RelayState, identity: string): string {
  return state.peers.find((peer) => peer.identity === identity)?.name ?? shortId(identity)
}

function shortId(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString()
}
