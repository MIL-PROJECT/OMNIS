import { copyFile, open, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { manualCatalog, type ManualInfo } from '../../shared/manuals'

function entryFor(role: string) {
  const entry = manualCatalog.find((m) => m.role === role)
  if (!entry) throw new Error('지원하지 않는 매뉴얼입니다.')
  return {
    ...entry,
    filename: `OMNIS_${entry.title.replaceAll(' ', '')}_사용자매뉴얼.pdf`
  }
}

export async function listManuals(root: string): Promise<ManualInfo[]> {
  return Promise.all(
    manualCatalog.map(async (m) => {
      const entry = entryFor(m.role)
      try {
        const info = await stat(join(root, `${m.role}.pdf`))
        return {
          ...entry,
          bytes: info.size,
          available: info.isFile() && info.size > 5
        }
      } catch {
        return { ...entry, bytes: 0, available: false }
      }
    })
  )
}

async function sourceFor(root: string, role: string): Promise<string> {
  entryFor(role)
  const source = join(root, `${role}.pdf`)
  try {
    const file = await open(source, 'r')
    try {
      const header = Buffer.alloc(5)
      await file.read(header, 0, 5, 0)
      if (header.toString() !== '%PDF-') throw new Error('Invalid PDF')
    } finally {
      await file.close()
    }
  } catch {
    throw new Error(
      '매뉴얼 파일을 찾을 수 없거나 읽을 수 없습니다. 앱을 다시 설치해 주세요.'
    )
  }
  return source
}

export async function openManual(
  root: string,
  role: string,
  openPath: (path: string) => Promise<string>
): Promise<void> {
  const source = await sourceFor(root, role)
  if (await openPath(source))
    throw new Error(
      'PDF를 열 수 없습니다. PDF 뷰어를 확인하거나 다운로드 후 열어 주세요.'
    )
}

export async function saveManual(
  root: string,
  role: string,
  choosePath: (filename: string) => Promise<string | undefined>
): Promise<{ canceled: boolean; filename?: string }> {
  const entry = entryFor(role),
    source = await sourceFor(root, role)
  const chosen = await choosePath(entry.filename)
  if (!chosen) return { canceled: true }
  const destination = chosen.toLowerCase().endsWith('.pdf')
    ? chosen
    : `${chosen}.pdf`
  if (resolve(destination) === resolve(source))
    throw new Error('앱에 포함된 원본 대신 다른 저장 위치를 선택해 주세요.')
  try {
    await copyFile(source, destination)
  } catch {
    throw new Error(
      '매뉴얼 저장에 실패했습니다. 저장 위치와 권한을 확인해 주세요.'
    )
  }
  return { canceled: false, filename: entry.filename }
}
