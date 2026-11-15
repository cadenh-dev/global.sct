import { randomBytes } from 'node:crypto'
import { rename, rm, writeFile } from 'node:fs/promises'

export async function writeFileAtomic(file: string, contents: string | Buffer, mode: number): Promise<void> {
  const temporary = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  try {
    await writeFile(temporary, contents, { mode })
    await rename(temporary, file)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}
