import { app, dialog, shell } from 'electron'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import type { Channel, PublicUser } from '../../shared/contracts'
import { deleteAttachment, getAttachmentForOpen, listAttachments, storeAttachmentPaths, type AttachmentCategory, type AttachmentEntity } from './AttachmentStore'

export const attachmentRoot = (): string => join(app.getPath('userData'),'attachments')

export async function runAttachmentChannel(db: Database.Database, channel: Channel, p: Record<string,unknown>, user: PublicUser): Promise<unknown> {
  const root = attachmentRoot()
  if (channel === 'attachments:list') return listAttachments(db,user,p.entityType as AttachmentEntity,String(p.entityId))
  if (channel === 'attachments:add') {
    const selected = await dialog.showOpenDialog({
      title:'첨부자료 선택',properties:['openFile','multiSelections'],
      filters:[
        { name:'지원 파일',extensions:['jpg','jpeg','png','webp','gif','pdf','txt','log','csv','doc','docx','xls','xlsx','ppt','pptx','zip'] },
        { name:'모든 파일',extensions:['*'] }
      ]
    })
    if (selected.canceled) return []
    return storeAttachmentPaths(db,user,{ entityType:p.entityType as AttachmentEntity,entityId:String(p.entityId),category:p.category as AttachmentCategory,note:p.note ? String(p.note) : undefined },selected.filePaths,root)
  }
  if (channel === 'attachments:open') {
    const item = getAttachmentForOpen(db,user,String(p.id),root)
    const error = await shell.openPath(item.path)
    if (error) throw new Error(`첨부파일을 열 수 없습니다: ${error}`)
    return true
  }
  if (channel === 'attachments:delete') return deleteAttachment(db,user,String(p.id),root)
  return undefined
}

export const attachmentChannels = new Set<Channel>(['attachments:list','attachments:add','attachments:open','attachments:delete'])
