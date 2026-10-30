import { createHash, randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, extname, resolve, sep } from 'node:path'
import type Database from 'better-sqlite3'
import type { PublicUser } from '../../shared/contracts'

type Row = Record<string, unknown>
export type AttachmentEntity = 'INCIDENT' | 'MAINTENANCE'
export type AttachmentCategory = 'PHOTO' | 'LOG' | 'REPORT' | 'CHECKLIST' | 'OTHER'

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
export const MAX_ATTACHMENT_SELECTION = 5
const extensionMime: Record<string,string> = {
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif',
  '.pdf':'application/pdf','.txt':'text/plain','.log':'text/plain','.csv':'text/csv',
  '.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip':'application/zip'
}

const now = () => new Date().toISOString()
const one = (db: Database.Database, sql: string, ...args: unknown[]): Row | undefined => db.prepare(sql).get(...args) as Row | undefined

function isTeamMember(db: Database.Database, teamId: unknown, userId: string): boolean {
  return !!teamId && !!one(db,'SELECT id FROM team_members WHERE team_id=? AND user_id=? AND available=1',teamId,userId)
}

function entity(db: Database.Database, entityType: AttachmentEntity, entityId: string): Row {
  const row = entityType === 'INCIDENT'
    ? one(db,'SELECT id,status,reported_by,assigned_to,team_id FROM incidents WHERE id=?',entityId)
    : one(db,`SELECT m.id,m.status,m.assignee_id,i.reported_by,i.assigned_to,i.team_id
        FROM maintenance_tasks m LEFT JOIN incidents i ON i.id=m.incident_id WHERE m.id=?`,entityId)
  if (!row) throw new Error(entityType === 'INCIDENT' ? '고장 접수를 찾을 수 없습니다.' : '정비 작업을 찾을 수 없습니다.')
  return row
}

export function assertAttachmentAccess(db: Database.Database, user: PublicUser, entityType: AttachmentEntity, entityId: string, mutate = false): Row {
  const row = entity(db,entityType,entityId)
  let visible = ['ADMIN','OPERATOR','VIEWER'].includes(user.role)
  if (user.role === 'USER') visible = row.reported_by === user.id
  if (user.role === 'MAINTAINER') visible = row.assignee_id === user.id || row.assigned_to === user.id || isTeamMember(db,row.team_id,user.id)
  if (!visible) throw new Error('첨부자료에 접근할 권한이 없습니다.')
  if (!mutate) return row
  if (user.role === 'VIEWER') throw new Error('조회 전용 사용자는 첨부자료를 변경할 수 없습니다.')
  if (entityType === 'MAINTENANCE' && user.role === 'USER') throw new Error('정비 첨부자료를 변경할 권한이 없습니다.')
  if (['CLOSED','CANCELED','COMPLETED'].includes(String(row.status)) && user.role !== 'ADMIN') throw new Error('종결 또는 완료된 업무의 첨부자료는 관리자만 변경할 수 있습니다.')
  return row
}

export function validateAttachmentPath(sourcePath: string): { originalName:string; extension:string; mimeType:string; sizeBytes:number; sha256:string } {
  if (!existsSync(sourcePath)) throw new Error('선택한 파일을 찾을 수 없습니다.')
  const stat = statSync(sourcePath)
  if (!stat.isFile()) throw new Error('일반 파일만 첨부할 수 있습니다.')
  if (stat.size <= 0) throw new Error('빈 파일은 첨부할 수 없습니다.')
  if (stat.size > MAX_ATTACHMENT_BYTES) throw new Error('첨부파일은 개별 25MB 이하여야 합니다.')
  const extension = extname(sourcePath).toLowerCase()
  const mimeType = extensionMime[extension]
  if (!mimeType) throw new Error('허용되지 않은 파일 형식입니다. 이미지, PDF, 문서, 표, 텍스트, 로그 또는 ZIP 파일을 선택하십시오.')
  return { originalName:basename(sourcePath),extension,mimeType,sizeBytes:stat.size,sha256:createHash('sha256').update(readFileSync(sourcePath)).digest('hex') }
}

export function resolveAttachmentPath(root: string, storedPath: string): string {
  const target = resolve(root,...storedPath.split('/'))
  const safeRoot = resolve(root)
  if (target !== safeRoot && !target.startsWith(`${safeRoot}${sep}`)) throw new Error('잘못된 첨부파일 경로입니다.')
  return target
}

function recordEvent(db: Database.Database, user: PublicUser, entityType: AttachmentEntity, entityId: string, action: 'ADDED'|'REMOVED', name: string): void {
  const date = now()
  if (entityType === 'INCIDENT') {
    const status = one(db,'SELECT status FROM incidents WHERE id=?',entityId)?.status ?? null
    db.prepare('INSERT INTO incident_events (id,incident_id,event_type,from_status,to_status,note,actor_id,created_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)').run(randomUUID(),entityId,`ATTACHMENT_${action}`,status,status,`첨부자료 ${action === 'ADDED' ? '추가' : '삭제'}: ${name}`,user.id,date,JSON.stringify({ fileName:name }))
  } else {
    db.prepare('INSERT INTO maintenance_events VALUES (?,?,?,?,?,?)').run(randomUUID(),entityId,`ATTACHMENT_${action}`,`첨부자료 ${action === 'ADDED' ? '추가' : '삭제'}: ${name}`,user.id,date)
  }
}

function audit(db: Database.Database, user: PublicUser, action: string, id: string, value: unknown): void {
  db.prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(),user.id,action,'attachments',id,null,value ? JSON.stringify(value) : null,now())
}

export function listAttachments(db: Database.Database, user: PublicUser, entityType: AttachmentEntity, entityId: string): Row[] {
  assertAttachmentAccess(db,user,entityType,entityId)
  let mutable = true
  try { assertAttachmentAccess(db,user,entityType,entityId,true) } catch { mutable = false }
  const rows = db.prepare(`SELECT a.id,a.entity_type,a.entity_id,a.category,a.original_name,a.mime_type,a.size_bytes,a.sha256,a.note,a.uploaded_by,a.created_at,u.display_name uploaded_by_name
    FROM attachments a LEFT JOIN users u ON u.id=a.uploaded_by WHERE a.entity_type=? AND a.entity_id=? ORDER BY a.created_at DESC`).all(entityType,entityId) as Row[]
  return rows.map(row => ({ ...row, can_delete:mutable && (user.role === 'ADMIN' || row.uploaded_by === user.id) }))
}

export function storeAttachmentPaths(db: Database.Database, user: PublicUser, input: { entityType:AttachmentEntity; entityId:string; category:AttachmentCategory; note?:string }, sourcePaths: string[], root: string): Row[] {
  assertAttachmentAccess(db,user,input.entityType,input.entityId,true)
  if (!sourcePaths.length) return []
  if (sourcePaths.length > MAX_ATTACHMENT_SELECTION) throw new Error(`한 번에 최대 ${MAX_ATTACHMENT_SELECTION}개까지 첨부할 수 있습니다.`)
  const prepared = sourcePaths.map(sourcePath => ({ sourcePath,...validateAttachmentPath(sourcePath),id:randomUUID() }))
  const stored: { path:string; row:Row }[] = []
  try {
    for (const file of prepared) {
      const relativePath = `${input.entityType.toLowerCase()}/${input.entityId}/${file.id}${file.extension}`
      const path = resolveAttachmentPath(root,relativePath)
      mkdirSync(dirname(path),{ recursive:true })
      try { copyFileSync(file.sourcePath,path) } catch (error) { rmSync(path,{force:true}); throw error }
      stored.push({ path,row:{ id:file.id,entity_type:input.entityType,entity_id:input.entityId,category:input.category,original_name:file.originalName,stored_path:relativePath,mime_type:file.mimeType,size_bytes:file.sizeBytes,sha256:file.sha256,note:input.note?.trim() || null,uploaded_by:user.id,created_at:now() } })
    }
    db.transaction(() => {
      const insert = db.prepare('INSERT INTO attachments (id,entity_type,entity_id,category,original_name,stored_path,mime_type,size_bytes,sha256,note,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      for (const item of stored) {
        const r = item.row
        insert.run(r.id,r.entity_type,r.entity_id,r.category,r.original_name,r.stored_path,r.mime_type,r.size_bytes,r.sha256,r.note,r.uploaded_by,r.created_at)
        recordEvent(db,user,input.entityType,input.entityId,'ADDED',String(r.original_name))
        audit(db,user,'ATTACH',String(r.id),{ entityType:input.entityType,entityId:input.entityId,originalName:r.original_name,sizeBytes:r.size_bytes,sha256:r.sha256 })
      }
    })()
    return listAttachments(db,user,input.entityType,input.entityId)
  } catch (error) {
    for (const item of stored) rmSync(item.path,{ force:true })
    throw error
  }
}

export function getAttachmentForOpen(db: Database.Database, user: PublicUser, id: string, root: string): { path:string; row:Row } {
  const row = one(db,'SELECT * FROM attachments WHERE id=?',id)
  if (!row) throw new Error('첨부자료를 찾을 수 없습니다.')
  assertAttachmentAccess(db,user,row.entity_type as AttachmentEntity,String(row.entity_id))
  const path = resolveAttachmentPath(root,String(row.stored_path))
  if (!existsSync(path)) throw new Error('첨부파일이 저장소에 존재하지 않습니다.')
  return { path,row }
}

export function deleteAttachment(db: Database.Database, user: PublicUser, id: string, root: string): boolean {
  const row = one(db,'SELECT * FROM attachments WHERE id=?',id)
  if (!row) throw new Error('첨부자료를 찾을 수 없습니다.')
  assertAttachmentAccess(db,user,row.entity_type as AttachmentEntity,String(row.entity_id),true)
  if (user.role !== 'ADMIN' && row.uploaded_by !== user.id) throw new Error('본인이 등록한 첨부자료만 삭제할 수 있습니다.')
  const path = resolveAttachmentPath(root,String(row.stored_path))
  db.transaction(() => {
    db.prepare('DELETE FROM attachments WHERE id=?').run(id)
    recordEvent(db,user,row.entity_type as AttachmentEntity,String(row.entity_id),'REMOVED',String(row.original_name))
    audit(db,user,'DELETE_ATTACHMENT',id,{ entityType:row.entity_type,entityId:row.entity_id,originalName:row.original_name,sha256:row.sha256 })
  })()
  rmSync(path,{force:true})
  return true
}

export function purgeEntityAttachments(db: Database.Database, entityType: AttachmentEntity, entityId: string, root?: string): void {
  const rows = db.prepare('SELECT stored_path FROM attachments WHERE entity_type=? AND entity_id=?').all(entityType,entityId) as { stored_path:string }[]
  db.prepare('DELETE FROM attachments WHERE entity_type=? AND entity_id=?').run(entityType,entityId)
  if (root) for (const row of rows) rmSync(resolveAttachmentPath(root,row.stored_path),{ force:true })
}
