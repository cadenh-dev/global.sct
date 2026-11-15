import { z } from 'zod/v4'
import type { RelayActivityKey, RelayAcceptInput, RelayQueueInput, RelayTaskDecision } from '../shared/relay'

const messageIdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
const taskDecisionSchema = z.object({
  messageId: z.unknown(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  decision: z.enum(['approve', 'refuse', 'report'])
}).passthrough()
const activitySchema = z.object({
  kind: z.enum(['inbox', 'sent', 'task']), messageId: z.string(), peer: z.string()
}).passthrough()
const confirmationSchema = z.object({ pairId: z.unknown(), code: z.string() }).passthrough()
const queueSchema = z.object({
  projectId: z.string(), secretIds: z.array(z.string()), recipient: z.string().regex(/^[0-9a-f]{64}$/),
  accessExpiresAt: z.union([z.null(), z.number().safe().int()]), injectionOnly: z.boolean()
}).passthrough()
const acceptSchema = z.object({ messageId: messageIdSchema, projectId: z.string().min(1) }).passthrough()

export function requireTaskDecision(value: unknown): RelayTaskDecision {
  if (typeof value !== 'object' || value === null || !('messageId' in value) || !('digest' in value) || !('decision' in value) ||
    typeof value.digest !== 'string' || !/^[0-9a-f]{64}$/.test(value.digest) ||
    (value.decision !== 'approve' && value.decision !== 'refuse' && value.decision !== 'report')) {
    throw new Error('Select a task and a local decision.')
  }
  const parsed = taskDecisionSchema.safeParse({ messageId: value.messageId, digest: value.digest, decision: value.decision })
  if (!parsed.success) throw new Error('Select a task and a local decision.')
  return { messageId: requireMessageId(parsed.data.messageId), digest: parsed.data.digest, decision: parsed.data.decision }
}

export function requireMessageId(value: unknown): string {
  const parsed = messageIdSchema.safeParse(value)
  if (!parsed.success) throw new Error('The message ID is invalid.')
  return parsed.data
}

export function requireActivityKey(input: unknown): RelayActivityKey {
  if (typeof input !== 'object' || input === null || !('kind' in input) || !('messageId' in input) || !('peer' in input) ||
    (input.kind !== 'inbox' && input.kind !== 'sent' && input.kind !== 'task') ||
    typeof input.messageId !== 'string' || typeof input.peer !== 'string') {
    throw new Error('Select a delivery activity row.')
  }
  const parsed = activitySchema.safeParse({ kind: input.kind, messageId: input.messageId, peer: input.peer })
  if (!parsed.success) throw new Error('Select a delivery activity row.')
  return { kind: parsed.data.kind, messageId: parsed.data.messageId, peer: parsed.data.peer }
}

export function requireConfirmation(input: unknown): { pairId: string; code: string } {
  if (typeof input !== 'object' || input === null || !('code' in input) || typeof input.code !== 'string' || !('pairId' in input)) {
    throw new Error('Select a pair and its pairing code.')
  }
  const parsed = confirmationSchema.safeParse({ pairId: input.pairId, code: input.code })
  if (!parsed.success) throw new Error('Select a pair and its pairing code.')
  return { pairId: requirePairId(parsed.data.pairId), code: parsed.data.code }
}

export function requirePairId(pairId: unknown): string {
  if (typeof pairId !== 'string' || !/^[0-9]{1,20}$/.test(pairId)) throw new Error('The pair ID is invalid.')
  return pairId
}

export function requireQueueInput(value: unknown): RelayQueueInput {
  if (typeof value !== 'object' || value === null || !('projectId' in value) || typeof value.projectId !== 'string' ||
    !('secretIds' in value) || !Array.isArray(value.secretIds) || !value.secretIds.every((id) => typeof id === 'string') ||
    !('recipient' in value) || typeof value.recipient !== 'string' || !/^[0-9a-f]{64}$/.test(value.recipient) ||
    !('accessExpiresAt' in value) || (value.accessExpiresAt !== null && !Number.isSafeInteger(value.accessExpiresAt)) ||
    !('injectionOnly' in value) || typeof value.injectionOnly !== 'boolean') {
    throw new Error('Select a project, secrets, verified recipient, and a valid access deadline.')
  }
  const parsed = queueSchema.safeParse({ projectId: value.projectId, secretIds: value.secretIds, recipient: value.recipient,
    accessExpiresAt: value.accessExpiresAt, injectionOnly: value.injectionOnly })
  if (!parsed.success) throw new Error('Select a project, secrets, verified recipient, and a valid access deadline.')
  return parsed.data
}

export function requireAcceptInput(value: unknown): RelayAcceptInput {
  if (typeof value !== 'object' || value === null || !('messageId' in value) ||
    typeof value.messageId !== 'string' || !messageIdSchema.safeParse(value.messageId).success ||
    !('projectId' in value) || typeof value.projectId !== 'string' || !value.projectId) {
    throw new Error('Select a relay transfer and a destination project.')
  }
  const parsed = acceptSchema.safeParse({ messageId: value.messageId, projectId: value.projectId })
  if (!parsed.success) throw new Error('Select a relay transfer and a destination project.')
  return parsed.data
}
