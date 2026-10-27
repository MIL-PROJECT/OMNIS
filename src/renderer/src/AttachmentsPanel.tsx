import { useEffect, useState } from 'react'
import { Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material'
import AttachFileRounded from '@mui/icons-material/AttachFileRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded'
import type { Channel, Result } from '../../shared/contracts'
import { fmtDateTime } from './ui'

type Row = Record<string,any>
type EntityType = 'INCIDENT' | 'MAINTENANCE'
const categories = [['PHOTO','사진'],['LOG','로그'],['REPORT','보고서'],['CHECKLIST','점검표'],['OTHER','기타']] as const
const categoryLabel = Object.fromEntries(categories)
const bytes = (n:number) => n < 1024 ? `${n} B` : n < 1024*1024 ? `${(n/1024).toFixed(1)} KB` : `${(n/1024/1024).toFixed(1)} MB`
async function call<T>(channel: Channel,payload:Record<string,unknown>):Promise<T>{ const r=await window.omnis.invoke(channel,payload) as Result<T>; if(!r.ok) throw new Error(r.error.message); return r.data }

export default function AttachmentsPanel({ entityType,entityId,canAdd=true,onChanged }:{ entityType:EntityType; entityId:string; canAdd?:boolean; onChanged?:()=>void }) {
  const [rows,setRows]=useState<Row[]>([]),[category,setCategory]=useState('OTHER'),[note,setNote]=useState(''),[busy,setBusy]=useState(false)
  const load=()=>call<Row[]>('attachments:list',{entityType,entityId}).then(setRows).catch(e=>alert(e.message))
  useEffect(()=>{ load() },[entityType,entityId])
  const add=()=>{ setBusy(true); call<Row[]>('attachments:add',{entityType,entityId,category,note:note.trim()||undefined}).then(result=>{ if(result.length){setRows(result);setNote('');onChanged?.()} }).catch(e=>alert(e.message)).finally(()=>setBusy(false)) }
  const remove=(row:Row)=>{ if(!confirm(`첨부자료 '${row.original_name}'을 삭제하시겠습니까?`))return; call('attachments:delete',{id:row.id}).then(()=>{load();onChanged?.()}).catch(e=>alert(e.message)) }
  return <Box className="attachments-panel">
    <Box className="attachments-head"><Box className="attachments-title"><span className="attachment-title-icon"><AttachFileRounded/></span><Box><Typography className="dd-section">첨부자료</Typography><span>사진·PDF·문서·로그·ZIP · 파일당 최대 25MB</span></Box></Box>{canAdd&&<Stack className="attachment-controls" direction="row" spacing={1}><TextField select size="small" label="자료 구분" value={category} onChange={e=>setCategory(e.target.value)} sx={{minWidth:110}}>{categories.map(([v,t])=><MenuItem key={v} value={v}>{t}</MenuItem>)}</TextField><TextField size="small" label="설명(선택)" value={note} onChange={e=>setNote(e.target.value)} slotProps={{htmlInput:{maxLength:300}}}/><Button className="attachment-upload" variant="contained" startIcon={<AttachFileRounded/>} disabled={busy} onClick={add}>파일 선택</Button></Stack>}</Box>
    {rows.length?<Box className="attachment-list">{rows.map(row=><Box className="attachment-row" key={row.id}><span className="attachment-icon"><AttachFileRounded/></span><Box className="attachment-info"><strong>{row.original_name}</strong><span>{categoryLabel[row.category]??row.category} · {bytes(Number(row.size_bytes))} · {row.uploaded_by_name??'-'} · {fmtDateTime(row.created_at)}</span>{row.note&&<small>{row.note}</small>}</Box><Tooltip title="열기"><IconButton size="small" onClick={()=>call('attachments:open',{id:row.id}).catch(e=>alert(e.message))}><OpenInNewRounded fontSize="small"/></IconButton></Tooltip>{row.can_delete&&<Tooltip title="삭제"><IconButton size="small" color="error" onClick={()=>remove(row)}><DeleteOutlineRounded fontSize="small"/></IconButton></Tooltip>}</Box>)}</Box>:<Box className="attachment-empty">등록된 첨부자료가 없습니다.</Box>}
  </Box>
}
