# Open status

- The vault has no retry limit or delay after a failed unlock. [Storage design](storage-design.md#7-decisions-and-remaining-questions)
- A physical iPhone test must confirm that Wallet accepts a pass sent through AirDrop. [Wallet cards](wallet-cards.md#known-risk)
- A Droid run must confirm the Factory demo project. [Factory Droid demo project](../examples/factory/README.md)
- The Windows and Linux packages still need signing. [README](../README.md#known-limitations)
- The Windows caller check does not pin a certificate thumbprint. [README](../README.md#known-limitations)
- A direct Windows MCP client cannot start `sct.cmd`. [README](../README.md#known-limitations)
- The Windows Playwright suite still has macOS and POSIX assumptions. [Windows and Linux](windows-linux.md)
- The Windows secret test and sharing test still need platform fixes. [Windows and Linux](windows-linux.md)
- The Linux UI job and the macOS UI job exclude the test `manages secrets per project without rendering stored values`. Its `sct run` step opens a second unlock window that Playwright does not drive. [Test](../tests/app.spec.ts), [Checks workflow](../.github/workflows/checks.yml)
- Public STUN, remote TURN, and cross-network WebRTC remain unverified. [Windows and Linux](windows-linux.md)
- macOS and Linux platform checks remain open for Direct, WebRTC, app links, and sharing UI. [Archived implementation plan](archive/implementation-plan.md)
- Live VS Code verification remains open. [Archived remaining feature plan](archive/remaining-features-plan.md#starting-point)
