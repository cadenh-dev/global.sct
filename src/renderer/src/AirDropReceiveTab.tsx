import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SharingDevice, TransferPreview } from '../../shared/sharing'
import { HandoffModal, Scramble } from './SharingMotion'
import type { Project } from '../../shared/projects'
import type { Loaded, Run, UpdateSecrets } from './types'
import { secretCount } from './sharingHelpers'
import type { Receipt } from './sharingHelpers'

export function AirDropReceiveTab({ device, incoming, canImport, receipt, projects, location, busy, run, updateSecrets, setReceipt, update }: {
  device: SharingDevice
  incoming: TransferPreview[]
  canImport: boolean
  receipt: Receipt | null
  projects: Loaded<Project[]>
  location: string
  busy: boolean
  run: Run
  updateSecrets: UpdateSecrets
  setReceipt: (receipt: Receipt) => void
  update: (change: (incoming: TransferPreview[]) => TransferPreview[]) => void
}) {
  // The arrival modal shows one time for each receipt.
  const [closedReceipt, setClosedReceipt] = useState<string | null>(null)

  async function chooseFile() {
    await run('Reading the received file…', async () => {
      const transfer = await window.sct.pickTransfer()
      if (!transfer) return ''
      update((current) => [...current.filter((item) => item.id !== transfer.id), transfer])
      return 'Choose a project for these secrets.'
    })
  }

  return (
    <>
      {receipt && <section key={receipt.id} className="panel" aria-labelledby="receipt-heading">
        <h2 id="receipt-heading">Received from {receipt.sender}</h2>
        <ul className="sharing-names" aria-label={`Secrets imported into ${receipt.project}`}>
          {receipt.names.map((name) => <li key={name}><Scramble text={name} mode="decrypt" /></li>)}
        </ul>
      </section>}
      {receipt && closedReceipt !== receipt.id && <HandoffModal heading={`Receiving from ${receipt.sender}`}
        from={receipt.sender} to={receipt.project} stage="arrived" onDone={() => setClosedReceipt(receipt.id)} object={{
          shape: 'key',
          title: secretCount(receipt.names.length),
          detail: receipt.names.join(' ')
        }} />}
      {incoming.length > 0 && <section className="sharing-section" aria-labelledby="incoming-heading">
        <h2 id="incoming-heading">Received transfers</h2>
        {incoming.map((transfer) => (
          <IncomingTransfer key={transfer.id} transfer={transfer} projects={projects} location={location}
            busy={busy} run={run} updateSecrets={updateSecrets} setReceipt={setReceipt}
            remove={() => update((current) => current.filter((item) => item.id !== transfer.id))} />
        ))}
      </section>}
      <section className="panel" aria-labelledby="receive-heading">
        <h2 id="receive-heading">Receive secrets</h2>
        {!canImport && <p className="field-help">Verify the sender’s device before you import their secrets.</p>}
        <ol className="sharing-setup">
          <li>
            <h3>Ask them to send to this device</h3>
            <p>They choose {device.name} in the picker. Accept the file when the system asks.</p>
          </li>
          <li>
            <h3>Open the received file</h3>
            <p>The file name ends in .sct-transfer.</p>
            <button type="button" className={incoming.length > 0 ? 'secondary' : undefined} disabled={busy}
              onClick={() => { void chooseFile() }}>Choose received file…</button>
          </li>
          <li>
            <h3>Choose a project</h3>
            <p>The secrets appear on this tab. Choose the local project that keeps them.</p>
          </li>
        </ol>
      </section>
    </>
  )
}

function IncomingTransfer({ transfer, projects, location, busy, run, updateSecrets, setReceipt, remove }: {
  transfer: TransferPreview
  projects: Loaded<Project[]>
  location: string
  busy: boolean
  run: Run
  updateSecrets: UpdateSecrets
  setReceipt: (receipt: Receipt) => void
  remove: () => void
}) {
  const [destination, setDestination] = useState('')
  const project = projects.state === 'ready' ? projects.value.find((item) => item.id === destination) : undefined

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run('Importing the encrypted transfer…', async () => {
      const imported = await window.sct.importTransfer({ transferId: transfer.id, projectId: destination })
      updateSecrets((current) => [...current.filter((secret) => !imported.some((saved) => saved.id === secret.id)), ...imported])
      setReceipt({ id: transfer.id, sender: transfer.sender.name, project: project?.name ?? 'the selected project', names: imported.map((secret) => secret.name) })
      remove()
      return `Imported ${imported.length} ${imported.length === 1 ? 'secret' : 'secrets'} into ${project?.name ?? 'the selected project'}.`
    })
  }

  return (
    <section className="panel" aria-labelledby={`transfer-${transfer.id}`}>
      <h3 id={`transfer-${transfer.id}`}>From {transfer.sender.name}</h3>
      <p className="field-help">Source project: {transfer.projectName}. Import before {new Date(transfer.expiresAt).toLocaleString()}.</p>
      <ul className="sharing-names" aria-label={`Received secrets from ${transfer.projectName}`}>
        {transfer.secretNames.map((name) => <li key={name}>{name}</li>)}
      </ul>
      {projects.state === 'ready' && projects.value.length === 0 && <p><a href="#/">Add a local project</a> before you import these secrets.</p>}
      <form onSubmit={(event) => { void receive(event) }}>
        <fieldset disabled={busy || projects.state !== 'ready'}>
          <label htmlFor={`destination-${transfer.id}`}>Destination project</label>
          <select id={`destination-${transfer.id}`} value={destination} required onChange={(event) => setDestination(event.target.value)}>
            <option value="">Choose a local project</option>
            {projects.state === 'ready' && projects.value.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {project && <p className="path sharing-destination">{location}/{project.name}/secrets.sct</p>}
          <p className="field-help">Existing secrets stay unchanged. If names conflict, choose another project or resolve the names before import.</p>
          <div className="form-actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => {
              void run('Removing the pending transfer…', async () => {
                await window.sct.dismissTransfer(transfer.id)
                remove()
                return 'The pending transfer was removed.'
              })
            }}>Dismiss transfer</button>
            <button type="submit" disabled={!project || busy}>Import secrets</button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
