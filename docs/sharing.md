# Sharing between devices

Device pairing works on macOS, Windows, and Linux.
The pairing link and the `.sct-device` file contain public keys only.
Link mode works on all platforms.
AirDrop sending is macOS-only.

global.sct sends encrypted copies of secrets to a verified device.
The Link flow and the AirDrop flow need no relay and no agent.
The AirDrop flow also needs no network connection other than AirDrop.
On macOS, the **Sharing** screen has five tabs: **Verify devices**, **Send secrets**, **Receive secrets**, **Relay**, and **Link**.
On Windows and Linux, it has three tabs: **Verify devices**, **Relay**, and **Link**.
This page describes pairing, Link mode, and the macOS AirDrop tabs.
See [relay setup](relay.md) for the **Relay** tab.
See [Windows and Linux](windows-linux.md) for the platform limits.

Build the signed app with `bun run package:mac`. Then macOS opens `.sct-transfer` files in global.sct.
The development window registers no file type.

## Verify a device one time

When you open **Sharing** for the first time, global.sct creates a sharing identity in the vault.
Do these steps on both devices:

1. Open **Sharing**, then open the **Verify devices** tab.
2. Select **Copy pairing link**, or select **Save device card…** to write a `.sct-device` file.
3. Send the link or the file to the other device.
4. Ask the other person to send their link or file back.
5. Paste the link and select **Review pairing link**. Or select **Import .sct-device file…** and choose their card.
6. Compare the full pairing code on both devices. Use a trusted conversation, for example in person or on a call.
7. If both codes are the same, select **I compared this code on both devices**. Then select **Confirm recipient**.
8. If the codes are different, select **Cancel verification**.

On macOS, you can also select **Send my card to…** and choose the other Mac in the AirDrop picker.
If the keys of one device change, verify that device again.
The **Send secrets** tab stays unavailable until you verify one device.
On Windows and Linux, use **Link** or **Relay** to send secrets.

## Send

1. Open the **Send secrets** tab. You can also select **Share secrets** on a project page. Then global.sct keeps that project selected.
2. Choose the source project.
3. Choose a verified recipient.
4. Choose the secrets.
5. Select **Send to…**.
6. In the picker, choose the same Mac.

global.sct encrypts the package for that device before it writes the transfer file.
The helper `native/airdrop.swift` opens only the AirDrop picker. It does not open the full macOS share menu.
macOS reports the same result for a sent file and for **Cancel**. Thus the sender gets no delivery confirmation.

## Receive

1. Accept the AirDrop file. macOS saves it in Downloads.
2. Open the file. The signed app opens `.sct-transfer` files.
   As an alternative, open the **Receive secrets** tab and select **Choose received file…**.
3. Choose a local destination project.
4. Select **Import secrets**.

The sender's project name and folder do not select the destination.
global.sct saves the copies in the vault file of the destination project. Each copy gets a new data key.
If a secret name already exists in the destination, the import fails before any secret changes.

## Link mode

A Link is a text string that carries an encrypted transfer. Use any trusted conversation to send it.
The link contains ciphertext and one wrapped key. It does not contain a secret value.
Only the verified recipient can open it.
A link has a maximum of 16,384 characters and expires after 24 hours.

### Send a link

1. Open **Sharing**, then open the **Link** tab.
2. Choose the source project.
3. Choose a verified recipient.
4. Choose the secrets.
5. Set the optional access expiry and the injection-only rule.
6. Select **Create link**.
7. Select **Copy link** and send the link to the recipient.

The **Sent links** list keeps the link and its record after a restart.
If the link is too large, select fewer secrets or use **Relay**.

### Receive a link

1. Open the **Link** tab.
2. Paste the import link in **Paste import link**.
3. Select **Review link**.
4. Check the sender, project name, secret names, deadline, access expiry, and injection-only rule.
5. Choose a destination project.
6. Select **Import secrets**.
7. Select **Copy receipt link** and send the receipt link to the sender.

### Verify a link receipt

1. On the sender device, find the transfer in **Sent links**.
2. Paste the receipt link in **Paste receipt link**.
3. Select **Verify receipt**.

The state changes to `received` after the signature check.
A receipt from a different device or transfer fails.
After a restart, the saved record and its receipt state stay in the vault sharing folder.

## Rules

- A package expires after 24 hours. A package holds a maximum of 1000 secrets and 8 MiB.
- A Link has a maximum of 16,384 characters. An expired Link fails import.
- Before an import, global.sct checks the verified sender, the signature, the recipient, the timestamps, and the message ID.
- Receipt records and encrypted vault markers prevent a second import of the same package.
  The Link and Direct modes use the same vault transfer ID, so one envelope cannot be imported twice across those modes.
  This protection also applies after a restart or after an interrupted import.
  An interrupted import stays bound to its first destination project.
- An import makes a permanent local copy. Package expiry does not revoke an imported secret.
- global.sct does not send a secret that arrived through the relay with an injection-only grant or an expired grant.
- global.sct keeps outbound ciphertext in its app data until the app stops.
  After a crash, global.sct deletes expired packages when it starts again.
- An import or **Dismiss transfer** deletes the pending copy in the app data.
  The AirDrop file stays in Downloads. You can delete it after the import.
- Secret values and private keys never go into transfer files, logs, or renderer responses.
  Values exist in main-process memory during encryption and import. JavaScript cannot clear strings from memory.

## Send and receive animations

A modal shows each send and each arrival. The **Cards** screen uses the same modal. See [mock Wallet cards](wallet-cards.md).

- A drawing of the sender's Mac is on the left. A drawing of the recipient is on the right: a Mac, or an iPhone for a Wallet card.
- An object moves between the two drawings. A device card shows the device name and fingerprint.
  Secrets move as a key. A Wallet card moves as a credit card.
- An AirDrop send shows concentric rings in the middle. macOS reports no delivery.
  Thus the object goes into the rings and never lands on the recipient. The caption tells you that macOS does not confirm delivery.
- A relay send shows a SpacetimeDB hub in the middle. The key waits in the hub while the transfer is in the queue.
  The key lands on the recipient only when the relay reports `received`. You can close the modal while the key waits.
- A relay arrival shows the modal only while the **Relay** tab is open.
- After an import, the key lands on the project that you chose. An AirDrop import starts at the sender.
  A relay import goes from the sender through the hub.
- A relay send plays a quiet swoosh. The app makes the sound at run time with the Web Audio API.
- After the object goes into the rings or lands, the modal closes after 1.5 s.
  You cannot close it while the app makes the file or the transfer, or while the AirDrop picker is open.
- Reduced-motion settings show the final frame of each stage with no movement.
- Secret names change to random glyphs during encryption and back to the names after import.
  The glyphs are decoration. They do not show ciphertext. Screen readers get the real names.
