import { packager } from '@electron/packager'
import { flipFuses, FuseV1Options, FuseVersion } from '@electron/fuses'
import { join } from 'node:path'
import electron from 'electron/package.json'
import { stageDependencies } from './stage-dependencies'

if (process.platform !== 'linux' || (process.arch !== 'arm64' && process.arch !== 'x64')) {
  throw new Error(`The Linux package requires an arm64 or x64 Linux machine (current: ${process.platform}/${process.arch}).`)
}

await stageDependencies()

const [output] = await packager({
  dir: 'out',
  out: 'dist',
  name: 'global.sct',
  executableName: 'sct',
  electronVersion: electron.version,
  platform: 'linux',
  arch: process.arch,
  afterExtract: [async ({ buildPath }) => { await flipFuses(join(buildPath, 'electron'), { version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false, [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false, [FuseV1Options.OnlyLoadAppFromAsar]: true
  }) }],
  extraResource: ['skills'],
  // Linux cannot load a native library from inside the archive.
  asar: { unpack: '*.node' },
  overwrite: true
})

console.log(`Packaged app: ${output}`)
