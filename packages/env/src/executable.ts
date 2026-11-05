import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Windows cannot start the sct.cmd shim without a shell. The installer writes the real executable path for the SDK.
export function sctExecutable(): string {
  if (process.env.SCT_CLI) return requireExecutable(process.env.SCT_CLI)
  if (process.platform !== 'win32') return 'sct'
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return 'sct.exe'
  try {
    const config: unknown = JSON.parse(readFileSync(join(localAppData, 'Programs', 'global.sct', 'bin', 'sct.json'), 'utf8'))
    if (typeof config === 'object' && config !== null && 'executable' in config &&
      typeof config.executable === 'string') return requireExecutable(config.executable)
  } catch {
    // A missing or invalid config falls back to PATH.
  }
  return 'sct.exe'
}

function requireExecutable(executable: string): string {
  if (process.platform === 'win32' && !executable.toLowerCase().endsWith('.exe')) {
    throw new Error('Set SCT_CLI to the full path of sct.exe on Windows.')
  }
  return executable
}
