import { flipFuses, FuseV1Options, FuseVersion } from '@electron/fuses'

export async function flipElectronFuses(binaryPath: string): Promise<void> {
  await flipFuses(binaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true
  })
}
