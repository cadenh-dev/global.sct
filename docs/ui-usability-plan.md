# UI usability plan

Status: proposal. No implementation is approved yet. The owner must make the decisions in [Decisions](#decisions) first.

Date: 2026-11-15.

## Goal

Make the desktop app easier for a new user.
A new user must know what each page does and which step comes next.

This plan changes names, navigation, and help text.
It does not change vault storage, sharing protocols, or Agent Access.

## Problems now

- **Sharing** has six tabs in one row: Verify devices, Send, Relay, Link, Direct, and WebRTC. macOS adds Send secrets and Receive secrets.
  Four names are transport names. The page does not say which mode to use.
- **Storage** contains Vault access, Change passphrase, Vault folder, Appearance, and Links. Only Vault folder is about storage.
- The explanations are in `docs/`. The app does not show them.
  A new user does not know the sequence: add a project, add secrets, verify a device, then send.

## Out of scope

- A reveal action for stored secret values. The owner decided against it on 2026-11-15.
  It can be useful later for secrets that the user created on this device. It must never apply to an injection-only grant.
- Changes to the unlock screen, the approval window, and the VS Code extension.
- New sharing modes.

## Part 1: Rename Storage to Settings

1. Change the navigation label and the page heading to **Settings**.
2. Change the route to `#/settings`. See decision 2 for the old route.
3. Rename `src/renderer/src/StorageView.tsx` to `SettingsView.tsx`, and the component to `SettingsView`.
4. Put the sections in this sequence: Vault access, Change passphrase, Vault folder, Appearance, Links.
5. Replace each instruction to open **Storage** in `README.md` and `docs/`.
   The instructions are in `docs/sharing.md`, `docs/storage.md`, `docs/theme.md`, and `docs/windows-linux.md`. Search the other files also.
6. Update the selectors that use the name "Storage" in `tests/app.spec.ts` and `tests/theme.spec.ts`. See decision 4.

Do not rename `docs/storage.md` or `docs/storage-design.md`. They describe vault storage, not the page.

## Part 2: Sharing navigation

Recommended shape: a vertical list on the left and the selected feature on the right.

- Each list entry shows the feature name and one line that says when to use it.
- The sequence follows the task: Verify devices, Send, then the modes.
- At a width of 700 px or less, the list becomes the current horizontal row. A narrow window keeps its space.
- The routes, the panels, and the forms do not change. Only the navigation markup and its CSS change.
- The entry for the current page keeps `aria-current="page"`. Keyboard focus stays visible.

Proposed entry text. The implementer must check each line against `docs/sharing.md` before use.

| Entry | Line |
|---|---|
| Verify devices | Do this one time for each device before you send. |
| Send | Choose a mode that is available now, then send. |
| Relay | Queue a transfer for a device that is offline. Needs a configured relay. |
| Link | Send a text link through a conversation that you trust. |
| Direct | Send between two apps that are open now. Needs no server. |
| WebRTC | Connect two open apps with one offer link and one answer link. |

Alternative: group Sharing by task (Devices, Send, Receive, Activity) and move the four transports into those pages.
This is clearer, but it changes most of the Sharing page and its Playwright test.

## Part 3: Hints

- Add one line below each page heading that says what the page does.
- Make each empty state give the next step. Examples: Projects with no project, and Send with no verified device.
- Add short help text below the fields that use special terms: injection only, access expiry, relay ID, STUN, and TURN.
- Use the current `field-help` and `description` styles.
- Do not add tooltips, icons, or guided tours. The design rules require a simple window, and a tooltip does not work with a keyboard or a touch screen.

## Part 4: Guide

Recommended shape: a **Help** page in the app, with a link in the main navigation.

- First steps: four steps, each with a link to the page for that step.
- Sharing modes: a table that shows what each mode needs and when to use it.
- Terms: short definitions from `docs/glossary.md`.

The page is static text. It reads no vault data and calls no main-process operation.

Alternative: no Help page. Use the hints from Part 3 and one link to the documentation.

## Sequence

1. Part 1. It is small and independent.
2. Part 2 and Part 3 together. The list lines are the primary hints.
3. Part 4, after the names are final.

Use one pull request for each step.

## Design rules

Follow the design system section of `AGENTS.md`. The most applicable rules:

- Use the Hallmark Terminal theme with its Cream and Terminal variants. Declare all colors and fonts through role tokens.
- Use square surfaces with 1px rules. Do not use shadows, rounded corners, or pills.
- Do not add decorative panels, status dots, eyebrows, or tracked capital labels.
- Keep the window simple. Add only the controls that the task requires.

## Checks for each pull request

- `bun run check`, `bun run typecheck:tsc`, `bun run test`, and `bun run build:sdk` pass.
- `bun run react-doctor` returns 100/100 with no warnings.
- `bun run test:ui` shows no new failure. The test `manages secrets per project without rendering stored values` is a known failure on Linux and macOS.
- Screenshots show each changed page in Cream and Terminal, at desktop width and at 375 px.
- The page has no horizontal scroll at 375 px, except the Sharing row.

## Decisions

The owner must answer these before implementation starts.

1. **Sharing layout.** Vertical list with one line for each entry (recommended), groups by task, or the current row with added lines?
2. **Old route.** Must `#/storage` still open Settings? Recommended: no. Nothing outside the app links to it.
3. **Guide.** A Help page in the app (recommended), or hints only?
4. **Test changes.** Does the owner approve the changed "Storage" selectors, and later changes to `tests/sharing.spec.ts` if the Sharing navigation changes?
5. **Skills.** `AGENTS.md` requires the Hallmark skill for UI work and the ASD-STE100 skill for text. Is the implementer permitted to install them?
