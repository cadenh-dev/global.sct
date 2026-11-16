# Open status

- A physical iPhone test must confirm that Wallet accepts a pass sent through AirDrop. [Wallet cards](wallet-cards.md#known-risk)
- A Droid run must confirm the Factory demo project. [Factory Droid demo project](../examples/factory/README.md)
- The Windows and Linux packages still need signing. [README](../README.md#known-limitations)
- A Mac test must confirm the package that `bun run package:mac` signs with the `global.sct Development` identity. CI covers only the ad-hoc signature. [macOS signing](macos-signing.md#ci-release-builds)
- The Windows caller check does not pin a certificate thumbprint. [README](../README.md#known-limitations)
- On Windows, the excluded secret test also starts `cmd.exe` and stops at its prompt. [Windows and Linux](windows-linux.md)
- The Linux, macOS, and Windows UI jobs exclude the test `manages secrets per project without rendering stored values`. Its `sct run` step opens a second unlock window that Playwright does not drive. [Test](../tests/app.spec.ts), [Checks workflow](../.github/workflows/checks.yml)
- Remote TURN and cross-network WebRTC remain unverified. A public STUN server is checked only between two apps on one Linux computer. [Windows and Linux](windows-linux.md)
- macOS platform checks remain open for Direct, WebRTC, app links, and sharing UI. [Archived implementation plan](archive/implementation-plan.md)
- Live VS Code verification remains open. [Archived remaining feature plan](archive/remaining-features-plan.md#starting-point)
