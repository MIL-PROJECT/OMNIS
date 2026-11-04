import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const developmentExecutable = require('electron')

export function electronLaunchOptions({ dataDir, packagedExecutable = process.env.OMNIS_E2E_EXE } = {}) {
  const packaged = packagedExecutable ? resolve(packagedExecutable) : undefined
  return {
    executablePath: packaged ?? developmentExecutable,
    args: packaged ? [] : [resolve('out/main/index.js')],
    env: { ...process.env, OMNIS_E2E_DATA: resolve(dataDir) }
  }
}
