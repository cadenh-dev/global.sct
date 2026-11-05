# Windows and Linux

global.sct runs on Windows and Linux. The macOS-only features stay on macOS.

## What differs by platform

| Feature | macOS | Windows | Linux |
|---|---|---|---|
| Vault and secrets | Yes | Yes | Yes |
| `sct run` and `sct _env` | Yes | Yes | Yes |
| Agent Access | Yes | Yes | Yes |
| Device pairing by link or file | Yes | Yes | Yes |
| Direct sharing | Yes | Yes | Yes |
| Link sharing | Yes | Yes | Yes |
| Relay sharing | Yes | Yes | Yes, with libsecret |
| AirDrop sharing | Yes | No | No |
| Wallet cards | Yes | No | No |
| Caller signature check | Apple code signature | Authenticode signer | No code signature. The caller is unverified |

On Windows and Linux, the app hides the **Cards** link, the AirDrop controls, and the **Send secrets** and **Receive secrets** tabs. Use **Verify devices** to pair devices without the relay. Use **Direct** to send while both apps are online, **Link** to send without a relay, or **Relay** to send through the relay.
Direct needs outbound UDP. Both apps must be open and unlocked. The Windows and Linux packages include the Hyperswarm native modules.

## Requirements

- Bun 1.4.4 or later.
- Node.js 22.18 or later.
- Windows: PowerShell 5.1 or later. The caller check uses `Get-CimInstance` and `Get-AuthenticodeSignature`.
- Linux: a `/proc` file system. The caller check reads `/proc/<pid>/stat` and `/proc/<pid>/exe`.
- macOS only: the Xcode command line tools. The AirDrop helper uses `swiftc`.

## Build

Run these commands from the repository root.

```sh
bun install
bun run package:win    # Windows
bun run package:linux  # Linux
```

The output is in `dist/`:

- Windows: `dist/global.sct-win32-<arch>/sct.exe`
- Linux: `dist/global.sct-linux-<arch>/sct`

The build installs the production dependency closure, including the `@napi-rs/keyring` and Hyperswarm native modules for the host platform.
The build does not run `swiftc` on Windows or Linux.
The build does not sign the package. See [Signing](#signing).

A tag such as `v0.1.0-beta.1` builds all three platforms and publishes a GitHub prerelease with `SHA256SUMS.txt`.
Stable tags are rejected until signing is available. See [Windows and Linux signing](windows-linux-signing.md).

## Install the CLI

```sh
bun run install:cli
```

- Windows: the command writes `%LOCALAPPDATA%\Programs\global.sct\bin\sct.cmd`.
- Linux: the command writes `~/.local/bin/sct`.

Add the folder to `PATH`, then open a new terminal.
A terminal can start `sct.cmd`. A direct MCP client cannot start a `.cmd` file. Use the full `sct.exe` path, or `cmd /c sct mcp`.
The installer also writes `sct.json`. The `@sct/env` SDK reads it to start `sct.exe` without a shell. Set `SCT_CLI` to use another executable path.

Check the command. It returns the bundled skill list and exits:

```sh
sct skills
```

## Open links from other apps

Use the packaged app. Open **Storage**, find **Links**, and select **Register global.sct links**.

- Windows writes per-user registry values under `HKCU\Software\Classes\global-sct`. It needs no administrator rights. Moving the portable folder requires registration again.
- Linux writes `app.global-sct.desktop` under `$XDG_DATA_HOME/applications`, or `~/.local/share/applications`, and calls `xdg-mime`. A desktop session with `xdg-mime` is required.
- macOS uses the `CFBundleURLTypes` entry in the packaged `global.sct.app`.

If another app owns the scheme, select **Replace handler** in the app.
The development build uses paste. It does not change the operating-system handler.

## Signing

The Windows and Linux packages are unsigned beta builds. Releases use versioned tags such as `v0.1.0-beta.1`.
D13 is closed: three runners and versioned tags. D12 is deferred: no paid signing for now.
Do not publish an unsigned package as a signed build.
See [Windows and Linux signing](windows-linux-signing.md) for the signing path and the current release steps.

The Windows caller check requires a valid Authenticode signature and the matching publisher and product metadata.
Claude Code requires an `Anthropic` signer and `Claude Code` in the file metadata.
Visual Studio Code (`Code.exe`) requires a `Microsoft Corporation` signer and `Visual Studio Code` in the file metadata.
A listed caller that fails its signature check cannot request local approval.
Verify the metadata with the real Claude Code build before release. A certificate thumbprint pin is a follow-up.

## Limits

- Windows does not use process groups. `sct run` stops the child tree with `taskkill /T /F /PID`. It cannot always let the child exit cleanly after Ctrl+C.
- Linux has no code signature. A process name match gives an unverified caller. The app asks for the extra confirmation.
- The relay keeps its per-server cache keys in the OS secret store. A Linux system with no secret service cannot use the relay mailbox until these keys move. See [Relay cache keys](storage-design.md#7-decisions-and-remaining-questions).
- Linux needs `libsecret` for "Remember this device" and the relay cache keys. The passphrase path works without it.
- The Linux package uses the native packages that Bun selects for the host platform. Treat a musl build as unverified until its package loads the keyring and Hyperswarm native modules.
- On Windows, file access uses the folder ACL. Keep the vault in a folder that only your account can access.
- A direct MCP client cannot start `sct.cmd`. Use `cmd /c sct mcp` or the full `sct.exe` path.
- The existing Playwright suite now unlocks the vault, but it still uses macOS and POSIX assumptions. `tests/platform.spec.ts` is the Windows smoke test.

## Checks

Run these commands after a code change:

```sh
bun run typecheck
bun run check
bun run build:sdk
bun run react-doctor
bun run test:ui
```

The Windows and Linux package jobs run on their own check runners. They build unsigned packages only.
The Playwright tests need a graphical session. The Windows smoke test runs on the Windows check runner.
The existing suite now unlocks the vault, but it still uses macOS and POSIX assumptions. It needs platform gating before it can run on all platforms.
