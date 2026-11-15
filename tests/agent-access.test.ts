import assert from 'node:assert/strict'
import { copyFile, mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { TestContext } from 'node:test'
import { AgentAccess } from '../src/main/agent-access.ts'
import { InMemorySecretStore } from '../src/main/key-store.ts'
import { ProjectStore } from '../src/main/projects.ts'
import { Sharing } from '../src/main/sharing.ts'
import { Vault } from '../src/main/vault.ts'

test('agent access rejects extra fields and arbitrary commands', async (t) => {
  const { access } = await setup(t)
  assert.equal((await access.submit({ operation: 'project_setup', input: { name: 'Synthetic', unexpected: true } })).status, 'failed')
  assert.equal((await access.submit({ operation: 'run_demo', input: { command: 'synthetic command' } })).status, 'failed')
})

test('agent access expires requests at their local deadline', async (t) => {
  const { access, directory } = await setup(t)
  assert.equal((await access.submit({ operation: 'project_setup', input: {
    name: 'Synthetic', directory, expiresAt: new Date(Date.now() - 1_000).toISOString()
  } })).status, 'failed')
  const pending = access.submit({ operation: 'project_setup', input: {
    name: 'Synthetic', directory, expiresAt: new Date(Date.now() + 150).toISOString()
  } })
  await waitForPending(access)
  assert.equal((await pending).status, 'expired')
})

test('agent access records refusal and requires extra confirmation for an unverified caller', async (t) => {
  const { access, directory } = await setup(t)
  const refused = access.submit({ operation: 'project_setup', input: { name: 'Refused', directory } })
  await waitForPending(access)
  const refusedId = access.views().find((view) => view.status === 'pending')?.id
  assert.ok(refusedId)
  await access.respond({ id: refusedId, approved: false })
  assert.equal((await refused).status, 'refused')

  const pending = access.submit({ operation: 'project_setup', input: { name: 'Approved', directory } })
  await waitForPending(access)
  const requestId = access.views().find((view) => view.status === 'pending')?.id
  assert.ok(requestId)
  await assert.rejects(access.respond({ id: requestId, approved: true }), /started this request/)
  await access.respond({ id: requestId, approved: true, startedByMe: true })
  assert.equal((await pending).status, 'completed')
})

async function setup(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'sct-agent-test-')))
  const directory = join(root, 'synthetic-project')
  await mkdir(directory)
  const projects = new ProjectStore(join(root, 'app-data', 'projects.json'))
  const vault = new Vault(projects, join(root, 'app-data', 'settings.json'), root, new InMemorySecretStore())
  await vault.start()
  await vault.unlock({ passphrase: 'synthetic passphrase', remember: false })
  const sharing = new Sharing(join(root, 'sharing'), vault, 'Synthetic device')
  t.after(async () => rm(root, { recursive: true, force: true }))
  const access = new AgentAccess(projects, vault, {
    review: async () => undefined,
    changed: () => undefined,
    sharing: async () => sharing,
    shareFile: async (path) => {
      await mkdir(join(root, 'shared-files'), { recursive: true })
      await copyFile(path, join(root, 'shared-files', randomUUID()))
    },
    approveShare: async (_summary, execute) => execute(),
    relayState: async () => ({ connection: 'off', identity: null, registered: false, error: null, updatedAt: null,
      peers: [], inbox: [], sent: [], tasks: [] }),
    requestRemoteDemo: async (grantId) => {
      const taskId = randomUUID()
      await mkdir(join(root, 'requests'), { recursive: true })
      await writeFile(join(root, 'requests', `${taskId}.json`), JSON.stringify({ grantId }))
      return taskId
    },
    caller: Promise.resolve({ name: 'Synthetic caller', verified: false }),
    executable: process.execPath,
    demoArguments: []
  })
  return { access, directory }
}

async function waitForPending(access: AgentAccess): Promise<void> {
  for (let attempt = 0; attempt < 20 && !access.views().some((view) => view.status === 'pending'); attempt += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  assert.equal(access.views().some((view) => view.status === 'pending'), true)
}
