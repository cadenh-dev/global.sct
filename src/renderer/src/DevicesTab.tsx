import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { PairingPreview, SharingDevice } from '../../shared/sharing'
import { pairingLinkLimit } from '../../shared/sharing'
import { HandoffModal } from './SharingMotion'
import type { HandoffStage } from './SharingMotion'
import type { Run } from './types'
import { sharingRoute } from './sharingHelpers'

export function DevicesTab({ projectId, device, peers, busy, run, isMac, initialLink, onDismissLink, onVerified }: {
  projectId?: string
  device: SharingDevice
  peers: SharingDevice[]
  busy: boolean
  run: Run
  isMac: boolean
  initialLink?: string
  onDismissLink?: () => void
  onVerified: (device: SharingDevice) => void
}) {
  const [pairing, setPairing] = useState<PairingPreview | null>(null)
  const [compared, setCompared] = useState(false)
  const [link, setLink] = useState(initialLink ?? '')
  const [cardStage, setCardStage] = useState<HandoffStage | null>(null)
  const importButton = useRef<HTMLButtonElement>(null)
  const comparisonHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (pairing) comparisonHeading.current?.focus()
  }, [pairing])

  async function shareCard() {
    setCardStage('wait')
    const shared = await run('Choose their Mac in the picker.', async () => {
      await window.sct.shareDeviceCard()
      return 'If you chose their Mac, your public device card is on its way. Ask them to send their card back.'
    })
    setCardStage(shared ? 'handed' : null)
  }

  async function addPeer() {
    await run('Reading the device card…', async () => {
      setPairing(await window.sct.pickSharingPeer())
      setCompared(false)
      return ''
    })
  }

  async function pastePeer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run('Reading the pairing link…', async () => {
      setPairing(await window.sct.previewPairingLink(link))
      setCompared(false)
      return ''
    })
  }

  async function confirmPeer() {
    if (!pairing) return
    await run('Saving the verified device…', async () => {
      const verified = await window.sct.confirmSharingPeer(pairing.token)
      onVerified(verified)
      onDismissLink?.()
      setPairing(null)
      setCompared(false)
      return `${verified.name} is verified on this device.`
    })
  }

  return (
    <>
      {peers.length > 0 && <section className="sharing-verified" aria-labelledby="verified-heading">
        <div className="group-heading">
          <h2 id="verified-heading">Verified devices</h2>
          {isMac && <a className="button-link" href={sharingRoute('secrets', projectId)}>Continue to Send secrets</a>}
        </div>
        <ul className="sharing-peers" aria-label="Verified devices">
          {peers.map((peer) => <li key={peer.id}>
            <details className="sharing-details">
              <summary>{peer.name}</summary>
              <p className="sharing-fingerprint">{peer.fingerprint}</p>
            </details>
          </li>)}
        </ul>
      </section>}
      <section className="panel" aria-labelledby="devices-heading">
      <h2 id="devices-heading">{peers.length === 0 ? 'Verify your first device' : 'Verify another device'}</h2>
      <p>Exchange public device cards by link or file. Pairing needs no relay.</p>
      <ol className="sharing-setup">
        <li>
          <h3>Send your device card</h3>
          <p>Your card contains public keys only. Send the link or saved file to the other device.</p>
          <div className="form-actions">
            <button type="button" disabled={busy} onClick={() => {
              void run('Copying the pairing link…', async () => {
                await window.sct.copyPairingLink()
                return 'Pairing link copied. Send it to the other device.'
              })
            }}>Copy pairing link</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => {
              void run('Choose where to save your device card.', async () =>
                await window.sct.saveDeviceCard() ? 'Device card saved. Send it to the other device.' : '')
            }}>Save device card…</button>
            {isMac && <button type="button" className="secondary" disabled={busy}
              onClick={() => { void shareCard() }}>Send my card to…</button>}
          </div>
          {cardStage && <HandoffModal heading="Sending your device card" from="This device" to="Their Mac" stage={cardStage}
            onDone={() => setCardStage(null)} object={{ shape: 'device', name: device.name, fingerprint: device.fingerprint }} />}
        </li>
        <li>
          <h3>Import their device card</h3>
          <form onSubmit={(event) => { void pastePeer(event) }}>
            <fieldset disabled={busy}>
              <label htmlFor="pairing-link">Paste pairing link</label>
              <input id="pairing-link" value={link} maxLength={pairingLinkLimit} required spellCheck={false}
                autoComplete="off" onChange={(event) => setLink(event.target.value)} />
              <div className="form-actions">
                <button type="submit" className="secondary" disabled={!link}>Review pairing link</button>
              </div>
            </fieldset>
          </form>
          <p>Or choose their .sct-device file.</p>
          <button ref={importButton} type="button" className="secondary" disabled={busy}
            onClick={() => { void addPeer() }}>Import .sct-device file…</button>
        </li>
      </ol>
      {pairing && (
        <div className="pairing-review" aria-labelledby="pairing-heading">
          <h3 ref={comparisonHeading} tabIndex={-1} id="pairing-heading">Compare codes with {pairing.device.name}</h3>
          <p className="pairing-code" aria-label="Pairing code">{pairing.code}</p>
          <p className="field-help">Have them import your card too. Both devices must show this exact code before either person confirms.</p>
          <label className="check-field">
            <input type="checkbox" checked={compared} disabled={busy} onChange={(event) => setCompared(event.target.checked)} />
            I compared this code on both devices
          </label>
          <div className="form-actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => {
              onDismissLink?.()
              setPairing(null)
              setCompared(false)
              importButton.current?.focus()
            }}>Cancel verification</button>
            <button type="button" disabled={busy || !compared} onClick={() => { void confirmPeer() }}>Confirm recipient</button>
          </div>
        </div>
      )}
      {isMac && <details className="sharing-details">
        <summary>Their Mac is not in the picker?</summary>
        <p>On both Macs, turn on Wi-Fi and Bluetooth. In Finder, open AirDrop and allow discovery by Everyone.</p>
      </details>}
      <details className="sharing-details">
        <summary>This device’s details</summary>
        <p>{device.name}</p>
        <p className="path sharing-fingerprint">{device.fingerprint}</p>
      </details>
      </section>
    </>
  )
}
