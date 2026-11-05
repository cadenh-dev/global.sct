import { packager } from '@electron/packager'
import { cp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import manifest from '../package.json'
import electron from 'electron/package.json'

if (process.platform !== 'win32' || (process.arch !== 'arm64' && process.arch !== 'x64' && process.arch !== 'ia32')) {
  throw new Error(`The Windows package requires an arm64, x64, or ia32 Windows machine (current: ${process.platform}/${process.arch}).`)
}

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
for (const name of ['@napi-rs/keyring', `@napi-rs/keyring-win32-${process.arch}-msvc`]) {
  await cp(join('node_modules', name), join('out/node_modules', name), { recursive: true, dereference: true })
}

const [output] = await packager({
  dir: 'out',
  out: 'dist',
  name: 'global.sct',
  executableName: 'sct',
  electronVersion: electron.version,
  platform: 'win32',
  arch: process.arch,
  extraResource: ['out/demo', 'skills'],
  // Windows cannot load a native library from inside the archive.
  asar: { unpack: '*.node' },
  overwrite: true
})

console.log(`Packaged app: ${output}`)
