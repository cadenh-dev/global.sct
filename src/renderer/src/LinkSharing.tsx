import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Project } from '../../shared/projects'
import type { SecretMetadata } from '../../shared/secrets'
import type { SharingDevice } from '../../shared/sharing'
import type { LinkImportResult, LinkPreview, LinkRecord, LinkState } from '../../shared/transport'
import { SecretSelection } from './SecretSelection'
import { errorText } from './operation'
import type { Loaded, Run, UpdateSecrets } from './types'

interface LinkSharingProps {
  projectId?: string
  active: boolean
  projects: Loaded<Project[]>
  secrets: Loaded<SecretMetadata[]>
  peers: SharingDevice[]
  busy: boolean
  run: Run
  updateSecrets: UpdateSecrets
}

export function LinkSharing({ projectId, active, projects, secrets, peers, busy, run, updateSecrets }: LinkSharingProps) {
  const [links, setLinks] = useState<Loaded<LinkState>>({ state: 'loading' })

  useEffect(() => {
    if (!active) return
    let mounted = true
    const refresh = () => {
      window.sct.getLinkState().then((value) => {
        if (mounted) setLinks({ state: 'ready', value })
      }).catch((cause: unknown) => {
        if (mounted) setLinks({ state: 'error', error: errorText(cause, 'Cannot read the saved links.') })
      })
    }
    refresh()
    // Refresh the delivery deadline while the Link tab stays open.
    const timer = window.setInterval(refresh, 60_000)
    return () => { mounted = false; window.clearInterval(timer) }
  }, [active])

  const refresh = async () => setLinks({ state: 'ready', value: await window.sct.getLinkState() })
  return <>
    <LinkSend projectId={projectId} projects={projects} secrets={secrets} peers={peers} busy={busy} run={run} refresh={refresh} />
    <section className="panel" aria-labelledby="sent-links-heading">
      <h2 id="sent-links-heading">Sent links</h2>
      {links.state === 'loading' && <p role="status">Loading sent links…</p>}
      {links.state === 'error' && <p className="error" role="alert">{links.error}</p>}
      {links.state === 'ready' && (links.value.length === 0 ? <p>No sent links.</p> :
        <ul className="relay-peers" aria-label="Sent links">{links.value.map((record) =>
          <SentLink key={record.transferId} record={record} peers={peers} busy={busy} run={run} refresh={refresh} />
        )}</ul>)}
    </section>
    <LinkReceive projects={projects} busy={busy} run={run} updateSecrets={updateSecrets} />
  </>
}

function LinkSend({ projectId, projects, secrets, peers, busy, run, refresh }: Omit<LinkSharingProps, 'active' | 'updateSecrets'> & {
  refresh: () => Promise<void>
}) {
  const [source, setSource] = useState(projectId ?? '')
  const [recipient, setRecipient] = useState(peers.length === 1 ? peers[0]?.id ?? '' : '')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [accessExpiresAt, setAccessExpiresAt] = useState('')
  const [injectionOnly, setInjectionOnly] = useState(true)
  const [created, setCreated] = useState<LinkRecord | null>(null)

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run('Creating the encrypted link…', async () => {
      setCreated(await window.sct.createLink({ projectId: source, recipientId: recipient, secretIds: [...selected],
        accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt).getTime() : null, injectionOnly }))
      await refresh()
      return 'Link created. Send it to the selected device.'
    })
  }

  return <section className="panel" aria-labelledby="link-send-heading">
    <h2 id="link-send-heading">Send by link</h2>
    <p>Only the selected device can import this link. Send the link through your trusted conversation.</p>
    {peers.length === 0 && <p><a href="#/sharing/devices">Verify a device</a> before you send secrets.</p>}
    {projects.state === 'ready' && projects.value.length === 0 && <p><a href="#/">Add a project</a> before you send secrets.</p>}
    <form onSubmit={(event) => { void create(event) }}>
      <fieldset disabled={busy || peers.length === 0 || projects.state !== 'ready'}>
        <label htmlFor="link-source">Source project</label>
        <select id="link-source" value={source} required onChange={(event) => {
          setSource(event.target.value)
          setSelected(new Set())
        }}>
          <option value="">Choose a project</option>
          {projects.state === 'ready' && projects.value.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <label htmlFor="link-recipient">Verified recipient</label>
        <select id="link-recipient" value={recipient} required onChange={(event) => setRecipient(event.target.value)}>
          <option value="">Choose a verified device</option>
          {peers.map((peer) => <option key={peer.id} value={peer.id}>{peer.name}</option>)}
        </select>
        <SecretSelection secrets={secrets} source={source} selected={selected} onChange={setSelected} />
        <label htmlFor="link-access-expires">Access expires (optional)</label>
        <input id="link-access-expires" type="datetime-local" value={accessExpiresAt} onChange={(event) => setAccessExpiresAt(event.target.value)} />
        <label className="check-field">
          <input type="checkbox" checked={injectionOnly} onChange={(event) => setInjectionOnly(event.target.checked)} />
          Allow command injection only. Block reveal, copy, and reshare.
        </label>
        <p className="field-help">Import within 24 hours. For links above 16,384 characters, use Relay or select fewer secrets.</p>
        <div className="form-actions"><button type="submit" disabled={!source || !recipient || selected.size === 0}>Create link</button></div>
      </fieldset>
    </form>
    {created && <>
      <p>Link for {peers.find((peer) => peer.id === created.recipientId)?.name ?? created.recipientId}: {created.projectName}.</p>
      <p>Import before {new Date(created.deliverBy).toLocaleString()} (24-hour deadline).</p>
      <LinkOutput id="created-link" label="Import link" link={created.link} busy={busy} run={run} />
    </>}
  </section>
}

function SentLink({ record, peers, busy, run, refresh }: {
  record: LinkRecord
  peers: SharingDevice[]
  busy: boolean
  run: Run
  refresh: () => Promise<void>
}) {
  const [link, setLink] = useState('')

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run('Verifying the receipt…', async () => {
      await window.sct.verifyLinkReceipt({ transferId: record.transferId, link })
      await refresh()
      setLink('')
      return 'Receipt verified. The recipient imported the secrets.'
    })
  }

  return <li>
    <h3>{record.projectName}</h3>
    <p>To {peers.find((peer) => peer.id === record.recipientId)?.name ?? record.recipientId}</p>
    <p>{record.secretNames.join(', ')}</p>
    <p>Import before {new Date(record.deliverBy).toLocaleString()}.</p>
    <p>State: {record.state.state === 'manual' ? 'Manual. Waiting for a receipt.' : record.state.state}.</p>
    {record.state.state === 'received' && <p>Received {new Date(record.state.receipt.receivedAt).toLocaleString()}.</p>}
    {record.state.state === 'manual' && <CopyLink link={record.link} busy={busy} run={run} />}
    {record.state.state === 'expired' && <p className="field-help">The import deadline passed. If the recipient imported
      the link before the deadline, paste the receipt link.</p>}
    {(record.state.state === 'manual' || record.state.state === 'expired') && <form onSubmit={(event) => { void verify(event) }}>
      <fieldset disabled={busy}>
        <label htmlFor={`link-receipt-${record.transferId}`}>Paste receipt link</label>
        <textarea className="link-text" id={`link-receipt-${record.transferId}`} value={link} required spellCheck={false}
          autoComplete="off" onChange={(event) => setLink(event.target.value)} />
        <div className="form-actions"><button type="submit" disabled={!link}>Verify receipt</button></div>
      </fieldset>
    </form>}
  </li>
}

function LinkReceive({ projects, busy, run, updateSecrets }: Pick<LinkSharingProps, 'projects' | 'busy' | 'run' | 'updateSecrets'>) {
  const [link, setLink] = useState('')
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [destination, setDestination] = useState('')
  const [imported, setImported] = useState<LinkImportResult | null>(null)

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run('Verifying the import link…', async () => {
      setImported(null)
      setPreview(await window.sct.previewLink(link))
      return 'Review the transfer and choose a destination project.'
    })
  }

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run('Importing the encrypted link…', async () => {
      const result = await window.sct.importLink({ link, projectId: destination })
      updateSecrets((current) => [...current.filter((secret) => !result.secrets.some((saved) => saved.id === secret.id)), ...result.secrets])
      setImported(result)
      setPreview(null)
      return 'Secrets imported. Send the receipt link to the sender.'
    })
  }

  return <section className="panel" aria-labelledby="link-receive-heading">
    <h2 id="link-receive-heading">Receive by link</h2>
    <form onSubmit={(event) => { void review(event) }}>
      <fieldset disabled={busy}>
        <label htmlFor="link-import">Paste import link</label>
        <textarea className="link-text" id="link-import" value={link} required spellCheck={false} autoComplete="off"
          onChange={(event) => { setLink(event.target.value); setPreview(null); setImported(null) }} />
        <div className="form-actions"><button type="submit" className="secondary" disabled={!link}>Review link</button></div>
      </fieldset>
    </form>
    {preview && <>
      <h3>{preview.projectName}</h3>
      <p>From {preview.sender.name}</p>
      <p>{preview.secretNames.join(', ')}</p>
      <p>Import before {new Date(preview.deliverBy).toLocaleString()}.</p>
      <p>{preview.accessExpiresAt === null ? 'Access does not expire.' : `Access expires ${new Date(preview.accessExpiresAt).toLocaleString()}.`}</p>
      <p>{preview.injectionOnly ? 'Injection only. Reveal, copy, and reshare are blocked.' : 'Injection only: no. Resharing is allowed.'}</p>
      {projects.state === 'ready' && projects.value.length === 0 && <p><a href="#/">Add a local project</a> before import.</p>}
      <form onSubmit={(event) => { void receive(event) }}>
        <fieldset disabled={busy || projects.state !== 'ready'}>
          <label htmlFor="link-destination">Destination project</label>
          <select id="link-destination" value={destination} required onChange={(event) => setDestination(event.target.value)}>
            <option value="">Choose a local project</option>
            {projects.state === 'ready' && projects.value.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <p className="field-help">If a secret name exists in this project, the import fails without changes.</p>
          <div className="form-actions"><button type="submit" disabled={!destination}>Import secrets</button></div>
        </fieldset>
      </form>
    </>}
    {imported && <>
      <p>Imported from {imported.sender.name}: {imported.secretNames.join(', ')}.</p>
      <LinkOutput id="received-link" label="Receipt link" link={imported.receiptLink} busy={busy} run={run} receipt />
    </>}
  </section>
}

function LinkOutput({ id, label, link, busy, run, receipt }: {
  id: string; label: string; link: string; busy: boolean; run: Run; receipt?: boolean
}) {
  return <>
    <label htmlFor={id}>{label}</label>
    <textarea className="link-text" id={id} value={link} readOnly spellCheck={false} />
    <div className="form-actions"><CopyLink link={link} busy={busy} run={run} receipt={receipt} /></div>
  </>
}

function CopyLink({ link, busy, run, receipt }: { link: string; busy: boolean; run: Run; receipt?: boolean }) {
  return <button type="button" className="secondary" disabled={busy} onClick={() => {
    void run('Copying the link…', async () => {
      await window.sct.copyText(link)
      return receipt ? 'Receipt link copied. Send it to the sender.' : 'Link copied. Send it to the recipient.'
    })
  }}>{receipt ? 'Copy receipt link' : 'Copy link'}</button>
}
