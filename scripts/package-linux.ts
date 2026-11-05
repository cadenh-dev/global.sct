import { packager } from '@electron/packager'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import manifest from '../package.json'
import electron from 'electron/package.json'

if (process.platform !== 'linux' || (process.arch !== 'arm64' && process.arch !== 'x64')) {
  throw new Error(`The Linux package requires an arm64 or x64 Linux machine (current: ${process.platform}/${process.arch}).`)
}

// Use the active loader, not the presence of an installed musl loader. SCT_LIBC overrides detection.
const libc = requireLibc()

// The main process loads @napi-rs/keyring at runtime. Vite does not bundle native modules, so the app needs a copy.
// The listed dependency keeps the packager's prune step from removing the copy.
await writeFile('out/package.json', JSON.stringify({
  name: manifest.name,
  version: manifest.version,
  description: manifest.description,
  main: 'main/index.js',
  dependencies: { '@napi-rs/keyring': manifest.dependencies['@napi-rs/keyring'] }
}, null, 2))
await rm('out/node_modules', { recursive: true, force: true })
for (const name of ['@napi-rs/keyring', `@napi-rs/keyring-linux-${process.arch}-${libc}`]) {
  await cp(join('node_modules', name), join('out/node_modules', name), { recursive: true, dereference: true })
}

const [output] = await packager({
  dir: 'out',
  out: 'dist',
  name: 'sct',
  executableName: 'sct',
  electronVersion: electron.version,
  platform: 'linux',
  arch: process.arch,
  extraResource: ['out/demo', 'skills'],
  // Linux cannot load a native library from inside the archive.
  asar: { unpack: '*.node' },
  overwrite: true
})

console.log(`Packaged app: ${output}`)

function requireLibc(): 'gnu' | 'musl' {
  const override = process.env.SCT_LIBC
  if (override !== undefined) {
    if (override !== 'gnu' && override !== 'musl') throw new Error('Set SCT_LIBC to gnu or musl.')
    return override
  }
  const result = spawnSync('ldd', ['--version'], { encoding: 'utf8' })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.toLowerCase()
  if (output.includes('gnu libc') || output.includes('glibc')) return 'gnu'
  if (output.includes('musl')) return 'musl'
  // Fall back to the loader path only when ldd is unavailable.
  return ['/lib/ld-musl-x86_64.so.1', '/lib/ld-musl-aarch64.so.1'].some((path) => existsSync(path)) ? 'musl' : 'gnu'
}
