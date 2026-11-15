import type { Project } from '../../shared/projects'
import type { SecretMetadata } from '../../shared/secrets'
import { SendSharing } from './SendSharing'
import type { Loaded, Run } from './types'

export function SendTab({ projectId, active, projects, secrets, busy, run }: {
  projectId?: string
  active: boolean
  projects: Loaded<Project[]>
  secrets: Loaded<SecretMetadata[]>
  busy: boolean
  run: Run
}) {
  return <SendSharing projectId={projectId} active={active} projects={projects} secrets={secrets} busy={busy} run={run} />
}
