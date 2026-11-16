// The Help page is static text. It reads no vault data and calls no main-process operation.
export function HelpView({ isMac }: { isMac: boolean }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Help</h1>
          <p className="description">The first steps, the sharing modes, and the terms that this app uses.</p>
        </div>
      </div>

      <section className="panel" aria-labelledby="help-steps-heading">
        <h2 id="help-steps-heading">First steps</h2>
        <ol className="sharing-setup">
          <li>
            <h3>Add a project</h3>
            <p>A project is a name and an existing folder. Open <a href="#/">Projects</a> and select Add a project.</p>
          </li>
          <li>
            <h3>Add secrets</h3>
            <p>On <a href="#/">Projects</a>, select Open secrets for the project. Enter a name and a value for each secret.</p>
          </li>
          <li>
            <h3>Verify a device</h3>
            <p>Open <a href="#/sharing/devices">Verify devices</a> on both devices. Exchange the device cards and compare the pairing code. Do this one time for each device.</p>
          </li>
          <li>
            <h3>Send secrets</h3>
            <p>Open <a href="#/sharing/send">Send</a>. Choose the project, the secrets, and a mode that is available now.</p>
          </li>
        </ol>
      </section>

      <section className="panel" aria-labelledby="help-modes-heading">
        <h2 id="help-modes-heading">Sharing modes</h2>
        <p>Each mode sends encrypted secrets to a device that you verified.</p>
        <table className="help-table">
          <thead><tr><th scope="col">Mode</th><th scope="col">What it needs</th><th scope="col">When to use it</th></tr></thead>
          <tbody>
            {modes.filter((mode) => isMac || !mode.macOnly).map((mode) => <tr key={mode.name}>
              <th scope="row">{mode.name}</th>
              <td data-label="What it needs">{mode.needs}</td>
              <td data-label="When to use it">{mode.use}</td>
            </tr>)}
          </tbody>
        </table>
      </section>

      <section className="panel" aria-labelledby="help-terms-heading">
        <h2 id="help-terms-heading">Terms</h2>
        <dl className="help-terms">
          {terms.map(([term, definition]) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}
        </dl>
      </section>

      <section className="panel" aria-labelledby="help-docs-heading">
        <h2 id="help-docs-heading">Documentation</h2>
        <p>The full documentation is on GitHub. Copy this address into a browser.</p>
        <p className="path help-address">https://github.com/cadenh-dev/global.sct/tree/main/docs</p>
      </section>
    </>
  )
}

const modes: { name: string; needs: string; use: string; macOnly?: boolean }[] = [
  {
    name: 'Link',
    needs: 'A verified device.',
    use: 'You can send text through a conversation that you trust. The recipient imports the link within 24 hours.'
  },
  {
    name: 'Direct',
    needs: 'Both apps open and unlocked at the same time. No relay.',
    use: 'Both people are at their devices now.'
  },
  {
    name: 'WebRTC',
    needs: 'Both apps open and unlocked. One offer link and one answer link.',
    use: 'Both people are at their devices now and can exchange two links.'
  },
  {
    name: 'Mailbox',
    needs: 'A configured relay, a paired relay device, and your permission for each send.',
    use: 'The recipient device is not online now. The relay keeps one encrypted copy until the recipient imports it.'
  },
  {
    name: 'AirDrop',
    needs: 'Two Macs with Wi-Fi and Bluetooth on.',
    use: 'The other Mac is near you.',
    macOnly: true
  }
]

const terms: [term: string, definition: string][] = [
  ['Vault', 'The encrypted store of your secrets on this device. The vault passphrase unlocks it.'],
  ['Project', 'A name and an existing folder. global.sct does not read or change the files in the folder.'],
  ['Secret', 'A name and a value in a project. global.sct does not show a stored value again.'],
  ['Injection', 'Passing project secrets into a command when it starts. The command can read the values.'],
  ['Injection only', 'A rule on received secrets. It permits approved injection and denies reveal, copy, and reshare.'],
  ['Access expiry', 'A deadline on received secrets. After it, global.sct blocks new use of them. It cannot delete copies outside global.sct.'],
  ['Device card', 'A file or link with the public keys of a device. It contains no secret.'],
  ['Pairing', 'Both users compare a code from the keys of both devices. Each device then saves the other device as verified.'],
  ['Relay', 'A server that stores and routes encrypted transfers. It never receives the keys that decrypt them.'],
  ['Mailbox', 'The delivery mode that uses the relay. The relay keeps one encrypted copy until the recipient imports it.'],
  ['Relay ID', 'The 64-character ID of a device on the relay. Relay pairing needs the ID of the other device.'],
  ['STUN', 'A server that helps two apps on different networks find a direct path for WebRTC.'],
  ['TURN', 'A server that forwards encrypted WebRTC traffic when no direct path exists.']
]
