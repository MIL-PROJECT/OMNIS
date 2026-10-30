import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const buildDir = resolve('build')
const profileDir = resolve('tests/.tmp/icon-profile')
const source = resolve(buildDir, 'icon.svg')

function icnsChunk(type, png) {
  const header = Buffer.alloc(8)
  header.write(type, 0, 4, 'ascii')
  header.writeUInt32BE(png.length + 8, 4)
  return Buffer.concat([header, png])
}

function writeIcns(images) {
  const chunks = [
    ['icp4', images.get(16)],
    ['icp5', images.get(32)],
    ['icp6', images.get(64)],
    ['ic07', images.get(128)],
    ['ic08', images.get(256)],
    ['ic09', images.get(512)],
    ['ic10', images.get(1024)],
    ['ic11', images.get(64)],
    ['ic12', images.get(128)],
    ['ic13', images.get(256)],
    ['ic14', images.get(512)]
  ].map(([type, png]) => icnsChunk(type, png))
  const body = Buffer.concat(chunks)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 4, 'ascii')
  header.writeUInt32BE(body.length + 8, 4)
  writeFileSync(resolve(buildDir, 'icon.icns'), Buffer.concat([header, body]))
}

mkdirSync(buildDir, { recursive: true })
rmSync(profileDir, { recursive: true, force: true })
mkdirSync(profileDir, { recursive: true })
const app = await electron.launch({
  executablePath: require('electron'),
  args: [resolve('out/main/index.js')],
  env: { ...process.env, OMNIS_E2E_DATA: profileDir }
})

try {
  const page = await app.firstWindow()
  const svg = readFileSync(source, 'utf8')
  const html = `<style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`
  const images = new Map()
  for (const size of [16, 32, 64, 128, 256, 512, 1024]) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(html)
    const png = await page.screenshot({ omitBackground: true })
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
    if (width !== size || height !== size) throw new Error(`Unexpected PNG size: ${width}x${height}, expected ${size}x${size}`)
    images.set(size, png)
  }
  writeFileSync(resolve(buildDir, 'icon.png'), images.get(1024))
  writeIcns(images)
  console.log('Generated build/icon.png and build/icon.icns')
} finally {
  await app.close()
}
