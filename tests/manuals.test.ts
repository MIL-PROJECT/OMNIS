import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join, resolve, sep } from 'node:path'
import {
  listManuals,
  openManual,
  saveManual
} from '../src/main/services/ManualService'
import { manualCatalog } from '../src/shared/manuals'

let root: string
const parent = resolve('tests/.tmp')
const pdf = Buffer.from('%PDF-1.7\nVirtual manual fixture\n%%EOF')
beforeEach(() => {
  mkdirSync(parent, { recursive: true })
  root = mkdtempSync(join(parent, 'manuals-'))
  for (const m of manualCatalog) writeFileSync(join(root, `${m.role}.pdf`), pdf)
})
afterEach(() => {
  if (!resolve(root).startsWith(parent + sep))
    throw new Error('Unexpected test path')
  rmSync(root, { recursive: true, force: true })
})
describe('bundled user manuals', () => {
  it('lists all five roles without exposing source paths', async () => {
    const rows = await listManuals(root)
    expect(rows).toHaveLength(5)
    for (const r of rows) {
      expect(r.available).toBe(true)
      expect(r.bytes).toBe(pdf.length)
      expect(JSON.stringify(r)).not.toContain(root)
    }
  })
  it('copies the exact PDF bytes and adds a PDF extension', async () => {
    const out = join(root, 'download')
    expect(await saveManual(root, 'ADMIN', async () => out)).toMatchObject({
      canceled: false
    })
    expect(readFileSync(out + '.pdf')).toEqual(pdf)
  })
  it('does nothing when the save dialog is canceled', async () => {
    expect(await saveManual(root, 'USER', async () => undefined)).toEqual({
      canceled: true
    })
  })
  it('rejects unsupported roles and path traversal', async () => {
    await expect(
      saveManual(root, '../ADMIN', async () => join(root, 'out.pdf'))
    ).rejects.toThrow('지원하지')
    await expect(
      openManual(root, '../../etc/passwd', async () => '')
    ).rejects.toThrow('지원하지')
  })
  it('blocks source overwrite and reports destination failure', async () => {
    await expect(
      saveManual(root, 'ADMIN', async () => join(root, 'ADMIN.pdf'))
    ).rejects.toThrow('다른 저장 위치')
    await expect(
      saveManual(root, 'ADMIN', async () => join(root, 'missing', 'out.pdf'))
    ).rejects.toThrow('저장에 실패')
  })
  it('opens only the allowlisted PDF and handles viewer failure', async () => {
    let opened = ''
    await openManual(root, 'VIEWER', async (path) => {
      opened = path
      return ''
    })
    expect(opened).toBe(join(root, 'VIEWER.pdf'))
    await expect(
      openManual(root, 'VIEWER', async () => 'No viewer')
    ).rejects.toThrow('PDF를 열 수 없습니다')
  })
  it('handles missing or invalid files without opening or saving them', async () => {
    rmSync(join(root, 'USER.pdf'))
    expect(
      (await listManuals(root)).find((m) => m.role === 'USER')?.available
    ).toBe(false)
    await expect(
      openManual(root, 'USER', async () => {
        throw new Error('must not open')
      })
    ).rejects.toThrow('매뉴얼 파일')
    writeFileSync(join(root, 'ADMIN.pdf'), 'invalid')
    await expect(
      saveManual(root, 'ADMIN', async () => {
        throw new Error('must not prompt')
      })
    ).rejects.toThrow('매뉴얼 파일')
  })
  it('ships five actual readable PDF resources', async () => {
    const bundled = resolve('resources/manuals')
    expect((await listManuals(bundled)).every((m) => m.available)).toBe(true)
    for (const m of manualCatalog)
      expect(
        readFileSync(join(bundled, `${m.role}.pdf`))
          .subarray(0, 5)
          .toString()
      ).toBe('%PDF-')
  })
})
