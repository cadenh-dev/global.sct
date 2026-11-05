import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod/v4'
import { sctEnvironment, sctExecutable } from '../../env/src/executable'
import type { AgentOutcome } from '../../../src/shared/agent'
import type { SecretMetadata } from '../../../src/shared/secrets'

export type SctSecret = Pick<SecretMetadata, 'id' | 'name'>

const metadataOutcome = z.object({
  requestId: z.string(),
  status: z.enum(['completed', 'refused', 'expired', 'failed']),
  result: z.array(z.object({ id: z.string(), name: z.string(), projectId: z.string() })).optional(),
  error: z.string().optional()
})

export interface SctStatus {
  executable: string
  version: string
}

export async function readSctStatus(): Promise<SctStatus> {
  const executable = sctExecutable()
  // A global.sct release without --version opens the desktop window and does not exit, so the check stops after a time limit.
  const { stdout } = await promisify(execFile)(executable, ['--version'], { timeout: 10_000, env: sctEnvironment() })
  return { executable, version: stdout.trim() }
}

export function readSecretMetadata(cwd: string): Promise<SctSecret[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(sctExecutable(), ['agent', 'list_secrets', '--stdin'], {
      cwd, shell: false, windowsHide: true, env: sctEnvironment(), stdio: ['pipe', 'pipe', 'ignore']
    })
    let output = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => { output += chunk })
    child.once('error', () => reject(new Error('Cannot run global.sct. Check the CLI installation and SCT_CLI.')))
    child.stdin.once('error', () => reject(new Error('Cannot send the metadata request to global.sct.')))
    child.once('close', (code) => {
      try {
        const outcome = parseMetadataOutcome(output)
        if (outcome.status !== 'completed') {
          throw new Error(outcome.error || `The global.sct request ${outcome.status}.`)
        }
        if (code !== 0 || !outcome.result) throw new Error('The global.sct metadata request did not complete.')
        resolve(outcome.result.map(({ id, name }) => ({ id, name })))
      } catch (error) {
        reject(error)
      }
    })
    child.stdin.end('{}')
  })
}

function parseMetadataOutcome(output: string) {
  try {
    return metadataOutcome.parse(JSON.parse(output)) satisfies AgentOutcome
  } catch {
    throw new Error('The global.sct CLI returned an invalid metadata response.')
  }
}
