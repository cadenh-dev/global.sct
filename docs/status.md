# Open status

- The vault has no retry limit or delay after a failed unlock. [Storage design](storage-design.md#7-decisions-and-remaining-questions)
- A physical iPhone test must confirm that Wallet accepts a pass sent through AirDrop. [Wallet cards](wallet-cards.md#known-risk)
- Factory integration remains open. [Architecture](architecture.md#post-mvp)
- The Windows and Linux packages still need signing. [README](../README.md#known-limitations)
- The Windows caller check does not pin a certificate thumbprint. [README](../README.md#known-limitations)
- A direct Windows MCP client cannot start `sct.cmd`. [README](../README.md#known-limitations)
- The Windows Playwright suite still has macOS and POSIX assumptions. [Windows and Linux](windows-linux.md)
- The Windows secret test and sharing test still need platform fixes. [Windows and Linux](windows-linux.md)
- Public STUN, remote TURN, and cross-network WebRTC remain unverified. [Windows and Linux](windows-linux.md)
- macOS and Linux platform checks remain open for Direct, WebRTC, app links, and sharing UI. [Archived implementation plan](archive/implementation-plan.md)
- Live VS Code verification remains open. [Archived remaining feature plan](archive/remaining-features-plan.md#starting-point)
