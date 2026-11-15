import type { SecretMetadata } from '../shared/secrets'
import type { RelayMessageKind, RelayTaskOutcome } from '../shared/envelope'
import { z } from 'zod/v4'

// Transfers, tasks, and results use the same outbox, retries, and deadlines.
export interface OutboundTransfer {
  messageId: string
  kind: RelayMessageKind
  // Tasks only: the transfer whose grant the task uses, and the approval deadline.
  grantId: string | null
  approveBy: number | null
  // Results only: the task that the result answers.
  taskId: string | null
  recipient: string
  createdAt: number
  deliverBy: number
  payload: string
  wrappedKey: string
  accessExpiresAt: number | null
  error: string | null
}

export interface ReceivedTransfer {
  messageId: string
  digest: string
  sender: string
  createdAt: string
  deliverBy: number
  projectName: string
  secretNames: string[]
  accessExpiresAt: number | null
  injectionOnly: boolean
  destinationProjectId: string
  receivedAt: number | null
  secrets: SecretMetadata[]
  receipt: string | null
  complete: boolean
  acknowledged: boolean
  error: string | null
}

// A claim without an outcome after a restart becomes uncertain.
export type ReceivedTaskState = 'awaiting-approval' | 'claimed' | RelayTaskOutcome

export interface ReceivedTask {
  messageId: string
  digest: string
  sender: string
  createdAt: string
  deliverBy: number
  grantId: string
  approveBy: number
  state: ReceivedTaskState
  exitCode: number | null
  secretPresent: boolean | null
  finishedAt: number | null
  // Why the task did not complete. The result does not contain this text.
  reason: string | null
  // The user reviewed an uncertain outcome, so its result can go to the sender.
  reviewed: boolean
  receipt: string
  acknowledged: boolean
  // A problem with the delivery receipt or the result. A later pending run tries again.
  error: string | null
}

export interface ReceivedResult {
  messageId: string
  digest: string
  sender: string
  deliverBy: number
  taskId: string
  status: RelayTaskOutcome
  exitCode: number | null
  secretPresent: boolean | null
  finishedAt: number
  receipt: string
  acknowledged: boolean
  error: string | null
}

// The desktop app seals each agent request into the outbox, then deletes its file.
export interface TaskRequest {
  id: string
  grantId: string
  createdAt: number
  approveBy: number
}

const taskRequestSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
  grantId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
  createdAt: z.number().safe().int(),
  approveBy: z.number().safe().int()
})

export interface PendingResult {
  changed: boolean
  failed: boolean
}

export const taskApprovalPeriod = 24 * 60 * 60 * 1000

// A task can use only an imported grant from its sender, before the grant and approval deadlines.
export function taskRefusal(grant: ReceivedTransfer | undefined, sender: string, approveBy: number,
  now: number): { state: 'refused' | 'expired'; reason: string } | null {
  if (!grant || !grant.complete || grant.sender !== sender) {
    return { state: 'refused', reason: 'This task names no imported grant from its sender.' }
  }
  if (grant.accessExpiresAt !== null && grant.accessExpiresAt <= now) return { state: 'expired', reason: 'The grant of this task expired.' }
  if (approveBy <= now) return { state: 'expired', reason: 'The approval deadline passed.' }
  return null
}

export function isTaskRequest(value: unknown): value is TaskRequest {
  return taskRequestSchema.safeParse(value).success
}
