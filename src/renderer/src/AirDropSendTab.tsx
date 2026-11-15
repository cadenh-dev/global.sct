import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Project } from '../../shared/projects'
import type { SecretMetadata } from '../../shared/secrets'
import type { SharingDevice } from '../../shared/sharing'
import { HandoffModal, Scramble } from './SharingMotion'
import type { HandoffStage } from './SharingMotion'
import { SecretSelection } from './SecretSelection'
import type { Loaded, Run } from './types'
import { secretCount, selectedNames, sharingRoute } from './sharingHelpers'

export function AirDropSendTab({ projectId, active, projects, secrets, peers, busy, run }: {
  projectId?: string
  active: boolean
  projects: Loaded<Project[]>
  secrets: Loaded<SecretMetadata[]>
  peers: SharingDevice[]
  busy: boolean
  run: Run
}) {
  const source = projectId ?? ''
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [recipient, setRecipient] = useState(peers.length === 1 ? peers[0]?.id ?? '' : '')
  const [handoff, setHandoff] = useState<{ stage: HandoffStage; names: string[]; recipient: string } | null>(null)
  const projectField = useRef<HTMLSelectElement>(null)
  const recipientField = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (!active) return
    if (projectId) recipientField.current?.focus()
    else projectField.current?.focus()
  }, [active, projectId])

  const recipientName = peers.find((peer) => peer.id === recipient)?.name ?? 'their device'

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const sent = { names: selectedNames(secrets, selected), recipient: recipientName }
    setHandoff({ stage: 'wait', ...sent })
    const shared = await run(`Encrypting the secrets. Choose ${recipientName} in the picker.`, async () => {
      await window.sct.shareSecrets({ projectId: source, secretIds: [...selected], recipientId: recipient })
      return `If you chose ${recipientName}, the encrypted secrets are on their way. Their app confirms import.`
    })
    setHandoff(shared ? { stage: 'handed', ...sent } : null)
  }

  return (
    <section className="panel" aria-labelledby="send-heading">
      <h2 id="send-heading">Send secrets</h2>
      {projects.state === 'loading' && <p role="status">Loading projects…</p>}
      {projects.state === 'ready' && projects.value.length === 0 && <p><a href="#/">Add a project</a> to store and send secrets.</p>}
      {projects.state === 'ready' && projects.value.length > 0 && (
        <form onSubmit={(event) => { void send(event) }}>
          <fieldset disabled={busy}>
            <label htmlFor="sharing-project">Source project</label>
            <select ref={projectField} id="sharing-project" value={source} required onChange={(event) => {
              window.location.hash = sharingRoute('secrets', event.target.value)
            }}>
              <option value="">Choose a project</option>
              {projects.value.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <label htmlFor="sharing-recipient">Verified recipient</label>
            <select ref={recipientField} id="sharing-recipient" value={recipient} required onChange={(event) => setRecipient(event.target.value)}>
              <option value="">Choose a verified device</option>
              {peers.map((peer) => <option key={peer.id} value={peer.id}>{peer.name}</option>)}
            </select>
            <SecretSelection secrets={secrets} source={source} selected={selected} onChange={setSelected} />
            <p className="field-help">Choose the same device in the picker. Only that device can open the secrets and choose a destination project.</p>
            <div className="form-actions">
              <button type="submit" disabled={!source || !recipient || selected.size === 0}>
                {busy ? 'Please wait…' : 'Send to…'}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {handoff && <HandoffModal heading={`Sending secrets to ${handoff.recipient}`} from="This device" to={handoff.recipient}
        stage={handoff.stage} onDone={() => setHandoff(null)} object={{
          shape: 'key',
          title: secretCount(handoff.names.length),
          detail: <Scramble text={handoff.names.join(' ')} mode="encrypt" />
        }} />}
    </section>
  )
}
