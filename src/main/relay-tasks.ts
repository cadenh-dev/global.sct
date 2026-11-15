import type { SecretMetadata } from '../shared/secrets'
import type { RelayMessageKind, RelayTaskOutcome } from '../shared/envelope'
import type { RelayPeerKeys } from './envelope'
import type { Sharing } from './sharing'
import type { CachedInboxItem } from './relay-cache'
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

type TaskCrypto = Pick<Sharing, 'openRelayMessage' | 'sealRelayMessageReceipt'>

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

export async function openReceivedTask(identity: string, incoming: CachedInboxItem, crypto: TaskCrypto,
  sender: RelayPeerKeys, findGrant: (grantId: string) => ReceivedTransfer | undefined, receivedAt: number): Promise<ReceivedTask> {
  const opened = await crypto.openRelayMessage(identity, sender, 'task', Buffer.from(incoming.payload, 'base64'),
    Buffer.from(incoming.wrappedKey, 'base64'))
  const refusal = taskRefusal(findGrant(opened.contents.grantId), sender.identity, opened.contents.approveBy, receivedAt)
  return {
    messageId: incoming.messageId, digest: opened.digest, sender: sender.identity, createdAt: incoming.createdAt,
    deliverBy: opened.transfer.deliverBy, grantId: opened.contents.grantId, approveBy: opened.contents.approveBy,
    state: refusal?.state ?? 'awaiting-approval', exitCode: null, secretPresent: null,
    finishedAt: refusal ? receivedAt : null, reason: refusal?.reason ?? null, reviewed: false,
    receipt: (await crypto.sealRelayMessageReceipt(identity, sender, opened.transfer, receivedAt)).toString('base64'),
    acknowledged: false, error: null
  }
}

export async function openReceivedResult(identity: string, incoming: CachedInboxItem, crypto: TaskCrypto,
  sender: RelayPeerKeys, hasTask: (taskId: string, sender: string) => boolean): Promise<ReceivedResult> {
  const opened = await crypto.openRelayMessage(identity, sender, 'result', Buffer.from(incoming.payload, 'base64'),
    Buffer.from(incoming.wrappedKey, 'base64'))
  if (!hasTask(opened.contents.taskId, sender.identity)) {
    throw new Error('This result answers no task that this device sent to that device.')
  }
  return {
    messageId: incoming.messageId, digest: opened.digest, sender: sender.identity, deliverBy: opened.transfer.deliverBy,
    ...opened.contents,
    receipt: (await crypto.sealRelayMessageReceipt(identity, sender, opened.transfer, Date.now())).toString('base64'),
    acknowledged: false, error: null
  }
}

export function isTaskRequest(value: unknown): value is TaskRequest {
  return taskRequestSchema.safeParse(value).success
}
