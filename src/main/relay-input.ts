import type { RelayActivityKey, RelayAcceptInput, RelayQueueInput, RelayTaskDecision } from '../shared/relay'

export function requireTaskDecision(value: unknown): RelayTaskDecision {
  if (typeof value !== 'object' || value === null || !('messageId' in value) || !('digest' in value) || !('decision' in value) ||
    typeof value.digest !== 'string' || !/^[0-9a-f]{64}$/.test(value.digest) ||
    (value.decision !== 'approve' && value.decision !== 'refuse' && value.decision !== 'report')) {
    throw new Error('Select a task and a local decision.')
  }
  return { messageId: requireMessageId(value.messageId), digest: value.digest, decision: value.decision }
}

export function requireMessageId(value: unknown): string {
  if (typeof value !== 'string' || !isMessageId(value)) throw new Error('The message ID is invalid.')
  return value
}

export function requireActivityKey(input: unknown): RelayActivityKey {
  if (typeof input !== 'object' || input === null || !('kind' in input) || !('messageId' in input) || !('peer' in input) ||
    (input.kind !== 'inbox' && input.kind !== 'sent' && input.kind !== 'task') ||
    typeof input.messageId !== 'string' || typeof input.peer !== 'string') {
    throw new Error('Select a delivery activity row.')
  }
  return { kind: input.kind, messageId: input.messageId, peer: input.peer }
}

export function requireConfirmation(input: unknown): { pairId: string; code: string } {
  if (typeof input !== 'object' || input === null || !('code' in input) || typeof input.code !== 'string' || !('pairId' in input)) {
    throw new Error('Select a pair and its pairing code.')
  }
  return { pairId: requirePairId(input.pairId), code: input.code }
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
  return {
    projectId: value.projectId,
    secretIds: value.secretIds,
    recipient: value.recipient,
    accessExpiresAt: value.accessExpiresAt as number | null,
    injectionOnly: value.injectionOnly
  }
}

export function requireAcceptInput(value: unknown): RelayAcceptInput {
  if (typeof value !== 'object' || value === null || !('messageId' in value) ||
    typeof value.messageId !== 'string' || !isMessageId(value.messageId) ||
    !('projectId' in value) || typeof value.projectId !== 'string' || !value.projectId) {
    throw new Error('Select a relay transfer and a destination project.')
  }
  return { messageId: value.messageId, projectId: value.projectId }
}

export function isMessageId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
}
