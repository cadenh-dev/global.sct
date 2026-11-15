# Factory Droid demo project

This folder is a demo-only Factory project for local Agent Access.
It connects Droid to the installed `sct mcp` server and loads three tools only.

- `.factory/mcp.json` starts `sct mcp`. It contains no credentials.
- `enabledTools` permits `list_secrets`, `describe_secret`, and `run_demo`. Droid does not load the other `sct` tools.

No Droid run has confirmed this project. The checks below are open.

## Prepare

1. From the repository root, run the package command for your platform. Then run `bun run install:cli`.
2. Make sure that the `sct` command is on `PATH`.
3. Open the .sct app. Choose a storage location outside this repository.
4. In the .sct app, add this folder as a project. Droid cannot call `project_setup` here.
5. Add a test secret named `SCT_DEMO_TOKEN` to this project. Use a test value only.

## Start Droid

Interactive session, from this folder:

```sh
droid
```

Enter `/mcp` to see the `sct` server and its tools.

Headless check that loads one tool:

```sh
droid exec --only-tools MCP:sct/list_secrets "Call the sct list_secrets tool with {} and report the result."
```

List the tools that a headless run loads:

```sh
droid exec --list-tools
```

Each call opens the .sct approval window. Approve or refuse it there.

## What to check

- Droid lists `list_secrets`, `describe_secret`, and `run_demo` from the `sct` server, and no other `sct` tool.
- The .sct window labels the caller as unverified. global.sct has no signature data for Droid, so you must also select **I started this request myself**.
- `run_demo` starts the demo only after approval. Refusal and expiry start nothing.
- A missing project, an extra input field, or an expired deadline fails before approval.
- An approval applies to one request. The next request opens a new approval.
- Transcripts, results, and MCP logs contain no secret value.
- This folder contains no `.env` file or other secret file after the checks.
