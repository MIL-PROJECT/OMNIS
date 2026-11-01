import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Drawer, FormControlLabel, IconButton, LinearProgress, Pagination, Switch } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import { useNavigate } from 'react-router-dom'
import type { PublicUser, Result } from '../../shared/contracts'
import { situationSeverityMeta, situationStatusText, type SituationAlert, type SituationAlertSummary } from '../../shared/situationAlerts'
import SituationAlertDetail from './SituationAlertDetail'
import StatusChip from './StatusChip'
import { fmtDateTime } from './ui'
import { useVisibleRefresh } from './useVisibleRefresh'

async function loadAlerts():Promise<SituationAlert[]> {
  const result=await window.omnis.invoke('control:alerts') as Result<SituationAlert[]>
  if(!result.ok)throw new Error(result.error.message)
  return result.data
}

export function DashboardAlertPreview({summary,onSelect,onList}:{summary:SituationAlertSummary;onSelect:(id:string)=>void;onList:()=>void}) {
  if(!summary.openAlertCount)return null
  return <section className="dashboard-alert-preview" aria-label="미종료 상황경보">
    <div className="dashboard-alert-caption"><strong>상황경보 <small>{summary.openAlertCount}건</small></strong>{summary.criticalAlertCount>0&&<span>긴급 {summary.criticalAlertCount}건</span>}</div>
    <div className="dashboard-alert-rows">{summary.activeAlertPreview.map(alert=><button type="button" key={alert.id} className="dashboard-alert-row" onClick={()=>onSelect(alert.id)} aria-label={`${alert.title} 상세보기`}>
      <StatusChip code={alert.severity} label={situationSeverityMeta[alert.severity][0]} tone={situationSeverityMeta[alert.severity][1]}/>
      <span className="dashboard-alert-title" title={alert.title}>{alert.title}</span>
      <span className="dashboard-alert-scope" title={alert.impact_scope ?? ''}>{alert.impact_scope || '-'}</span>
      <StatusChip code={alert.status} label={situationStatusText[alert.status]}/>
      <time dateTime={alert.occurred_at}>{fmtDateTime(alert.occurred_at).slice(5)}</time><ChevronRightRounded aria-hidden/>
    </button>)}</div>
    <Button size="small" onClick={onList} aria-label="상황경보 전체 보기" endIcon={<ArrowForwardRounded/>}>전체 보기</Button>
  </section>
}

export type AlertPanelTarget={id?:string}
export function SituationAlertPanel({target,user,onClose,onExited}:{target:AlertPanelTarget|null;user:PublicUser;onClose:()=>void;onExited:()=>void}) {
  const navigate=useNavigate()
  const query=useVisibleRefresh(loadAlerts,!!target,`${user.id}:${user.role}`)
  const [selectedId,setSelectedId]=useState<string|null>(null)
  const [includeResolved,setIncludeResolved]=useState(false)
  const [page,setPage]=useState(1)
  const [notice,setNotice]=useState('')
  const scrollRef=useRef<HTMLDivElement>(null),scrollPosition=useRef(0)
  useEffect(()=>{setSelectedId(target?.id??null);setIncludeResolved(false);setPage(1);setNotice('');scrollPosition.current=0},[target])
  const selected=query.data?.find(alert=>alert.id===selectedId)
  useEffect(()=>{
    if(selectedId&&query.data&&!query.pending&&!selected){setSelectedId(null);setNotice('경보를 찾을 수 없습니다.')}
  },[selectedId,query.data,query.pending,selected])
  useLayoutEffect(()=>{if(!selectedId&&scrollRef.current)scrollRef.current.scrollTop=scrollPosition.current},[selectedId])
  const filtered=query.data?.filter(alert=>includeResolved||alert.status!=='RESOLVED')??[]
  const pages=Math.max(1,Math.ceil(filtered.length/8)),current=Math.min(page,pages)
  const items=filtered.slice((current-1)*8,current*8)
  const select=(id:string)=>{scrollPosition.current=scrollRef.current?.scrollTop??0;setSelectedId(id);setNotice('')}
  const canControl=['ADMIN','OPERATOR'].includes(user.role)
  return <Drawer anchor="right" open={!!target} onClose={onClose} slotProps={{paper:{className:'dashboard-alert-panel',role:'dialog','aria-modal':true,'aria-labelledby':'dashboard-alert-panel-title'},transition:{onExited}}}>
    <div className="dashboard-alert-panel-head">{selectedId&&<IconButton aria-label="경보 목록으로" onClick={()=>setSelectedId(null)}><ArrowBackRounded/></IconButton>}<h2 id="dashboard-alert-panel-title">{selectedId?'상황경보 상세':'상황경보'}</h2><IconButton aria-label="상황경보 패널 닫기" onClick={onClose}><CloseRounded/></IconButton></div>
    <div className="dashboard-alert-panel-progress">{query.pending&&<LinearProgress aria-label="상황경보 갱신 중"/>}</div>
    {query.error&&<Alert severity="warning" className="dashboard-alert-panel-error" action={<Button onClick={query.refresh}>다시 시도</Button>}>경보를 갱신하지 못했습니다.</Alert>}
    {notice&&<Alert severity="info" className="dashboard-alert-panel-error">{notice}</Alert>}
    {!query.data&&<div className="dashboard-alert-panel-empty">{query.pending?'불러오는 중…':query.error?'경보를 불러오지 못했습니다.':''}</div>}
    {query.data&&(selected?<>
      <div className="dashboard-alert-panel-body"><SituationAlertDetail alert={selected}/></div>
      <div className="dashboard-alert-panel-footer"><Button variant="outlined" onClick={()=>setSelectedId(null)}>목록</Button><Button variant="contained" endIcon={<ArrowForwardRounded/>} onClick={()=>navigate(`/control?${new URLSearchParams({alertId:selected.id})}`)}>{canControl&&selected.status!=='RESOLVED'?'통제에서 처리':'통제에서 보기'}</Button></div>
    </>:!selectedId?<>
      <div className="dashboard-alert-panel-filter"><strong>{includeResolved?'전체 이력':'미종료'} {filtered.length}건</strong><FormControlLabel control={<Switch checked={includeResolved} onChange={(_,value)=>{setIncludeResolved(value);setPage(1);scrollPosition.current=0;if(scrollRef.current)scrollRef.current.scrollTop=0}}/>} label="종료 이력 포함"/></div>
      <Box className="dashboard-alert-panel-list" ref={scrollRef}>
        {items.length?items.map(alert=><button className="dashboard-alert-list-row" type="button" key={alert.id} onClick={()=>select(alert.id)} aria-label={`${alert.title} 상세보기`}>
          <span className="dashboard-alert-list-main"><span className="dashboard-alert-list-meta"><StatusChip code={alert.severity} label={situationSeverityMeta[alert.severity][0]} tone={situationSeverityMeta[alert.severity][1]}/><StatusChip code={alert.status} label={situationStatusText[alert.status]}/><time dateTime={alert.occurred_at}>{fmtDateTime(alert.occurred_at)}</time></span><strong title={alert.title}>{alert.title}</strong><span className="dashboard-alert-list-scope" title={alert.impact_scope??''}>{alert.impact_scope||'-'}</span></span><ChevronRightRounded aria-hidden/>
        </button>):<p className="dashboard-alert-panel-empty">{includeResolved?'등록된 상황경보가 없습니다.':'미종료 상황경보가 없습니다.'}</p>}
      </Box>
      <div className="dashboard-alert-panel-footer"><span>{filtered.length?`${(current-1)*8+1}–${Math.min(current*8,filtered.length)} / ${filtered.length}건`:'0건'}</span><Pagination aria-label="상황경보 페이지" count={pages} page={current} onChange={(_,value)=>{setPage(value);scrollPosition.current=0;if(scrollRef.current)scrollRef.current.scrollTop=0}} disabled={pages===1} size="small"/></div>
    </>:null)}
  </Drawer>
}
