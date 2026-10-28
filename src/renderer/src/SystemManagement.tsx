import { useEffect, useState } from 'react'
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import StorageRounded from '@mui/icons-material/StorageRounded'
import SmartToyRounded from '@mui/icons-material/SmartToyRounded'
import BackupRounded from '@mui/icons-material/BackupRounded'
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded'
import ReportRounded from '@mui/icons-material/ReportRounded'
import HistoryRounded from '@mui/icons-material/HistoryRounded'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import StatusChip from './StatusChip'
import { Card, EmptyState, PageHeader, fmtDateTime, type Tone } from './ui'

type Row = Record<string, any>
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.omnis.invoke(channel,payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const actionTone: Record<string, Tone> = { CREATE:'green', UPDATE:'sky', UPDATE_STATUS:'sky', ASSIGN:'lavender', DELETE:'red', RESET:'red', BACKUP:'gray', SEED:'gray' }
const columns: GridColDef[] = [
  { field:'created_at',headerName:'시간',width:170,renderCell:({row}) => <span className="cell-muted">{fmtDateTime(row.created_at)}</span> },
  { field:'action',headerName:'작업',width:130,renderCell:({row}) => <StatusChip code={row.action} label={row.action} tone={actionTone[row.action] ?? 'gray'} /> },
  { field:'entity_type',headerName:'대상',width:190,renderCell:({row}) => <span className="cell-code">{row.entity_type}</span> },
  { field:'entity_id',headerName:'식별자',flex:1,renderCell:({row}) => <span className="cell-muted">{row.entity_id}</span> }
]
const bytes = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`

export default function SystemManagement({ user }: { user: PublicUser }) {
  const [info,setInfo] = useState<Row | null>(null),[audit,setAudit] = useState<Row[]>([]),[notifications,setNotifications] = useState<Row[]>([]),[tab,setTab] = useState(0),[step,setStep] = useState(0)
  const [provider,setProvider] = useState('LOCAL'),[endpoint,setEndpoint] = useState('http://127.0.0.1:11434'),[ollamaModel,setOllamaModel] = useState('gemma3'),[openaiModel,setOpenaiModel]=useState('gpt-6-luna'),[anthropicModel,setAnthropicModel]=useState('claude-haiku-5-5')
  const [externalEnabled,setExternalEnabled]=useState(false),[externalConsent,setExternalConsent]=useState(false),[timeoutSeconds,setTimeoutSeconds]=useState(15),[dailyLimit,setDailyLimit]=useState(50),[aiConfig,setAiConfig]=useState<Row|null>(null),[openaiKey,setOpenaiKey]=useState(''),[anthropicKey,setAnthropicKey]=useState(''),[aiBusy,setAiBusy]=useState('')
  const [planTime,setPlanTime] = useState('08:30'),[closeTime,setCloseTime] = useState('16:00'),[urgentSla,setUrgentSla] = useState(60),[normalSla,setNormalSla] = useState(480)
  const loadNotifications = () => call<Row[]>('system:notifications').then(setNotifications)
  const loadAi=()=>call<Row>('system:getAiSettings').then(r=>{setAiConfig(r);setProvider(r.provider);setEndpoint(r.ollamaEndpoint);setOllamaModel(r.ollamaModel);setOpenaiModel(r.openaiModel);setAnthropicModel(r.anthropicModel);setExternalEnabled(r.externalAiEnabled);setExternalConsent(Boolean(r.externalAiConsentAt));setTimeoutSeconds(r.timeoutSeconds);setDailyLimit(r.dailyRequestLimit)})
  useEffect(() => { call<Row>('system:getInfo').then(r => { setInfo(r);setPlanTime(r.planTime);setCloseTime(r.closeTime);setUrgentSla(r.urgentSlaMinutes);setNormalSla(r.normalSlaMinutes) }); loadNotifications(); if (user.role === 'ADMIN') { call<Row[]>('system:auditLogs',{ limit:100 }).then(setAudit);loadAi() } }, [user.role])
  const admin = user.role === 'ADMIN'
  const unread = notifications.filter(n => !n.read_at).length
  const infoRows: [string, React.ReactNode, boolean?][] = info ? [['앱 버전', info.version], ['스키마 버전', `v${info.schemaVersion}`], ['DB 크기', bytes(info.dbSize)], ['AI 제공자', info.aiProvider], ['DB 경로', info.dbPath, true], ['백업 경로', info.backupPath, true]] : []
  const saveAi=async()=>{setAiBusy('save');try{await call('system:setAiSettings',{provider,ollamaEndpoint:endpoint,ollamaModel,openaiModel,anthropicModel,externalAiEnabled:externalEnabled,externalConsent,timeoutSeconds,dailyRequestLimit:dailyLimit});await loadAi();setInfo(v=>v?{...v,aiProvider:provider}:v);alert('AI 설정을 저장했습니다.')}catch(e){alert((e as Error).message)}finally{setAiBusy('')}}
  const saveKey=async(kind:'OPENAI'|'ANTHROPIC')=>{const value=kind==='OPENAI'?openaiKey:anthropicKey;if(!value.trim())return;setAiBusy(`key-${kind}`);try{await call('system:saveAiCredential',{provider:kind,apiKey:value});if(kind==='OPENAI')setOpenaiKey('');else setAnthropicKey('');await loadAi()}catch(e){alert((e as Error).message)}finally{setAiBusy('')}}
  const deleteKey=async(kind:'OPENAI'|'ANTHROPIC')=>{setAiBusy(`delete-${kind}`);try{await call('system:deleteAiCredential',{provider:kind});await loadAi()}catch(e){alert((e as Error).message)}finally{setAiBusy('')}}
  const testProvider=async(kind:'OLLAMA'|'OPENAI'|'ANTHROPIC')=>{setAiBusy(`test-${kind}`);try{const r=await call<Row>('system:testAiConnection',{provider:kind});alert(r.success?`${kind} 연결에 성공했습니다. (${r.latencyMs}ms)`:r.message);await loadAi()}catch(e){alert((e as Error).message)}finally{setAiBusy('')}}
  return <>
    <PageHeader section="관리" title="시스템관리" description="시스템 정보, AI 설정, 데이터 백업과 감사 기록을 관리합니다." />
    <Tabs value={tab} onChange={(_,v) => setTab(v)} className="page-tabs">
      <Tab label="정보"/>
      <Tab label="알림" icon={unread ? <span className="tab-count">{unread}</span> : undefined} iconPosition="end"/>
      {admin && <Tab label="감사 로그"/>}
    </Tabs>

    {tab === 0 && <>
      <div className="dashboard-grid">
        <Card icon={StorageRounded} tone="sky" title="시스템 정보" subtitle="로컬 설치 환경">
          <dl className="info-list">{infoRows.map(([k, v, path]) => <div key={k}><dt>{k}</dt><dd className={path ? 'path' : ''}>{v}</dd></div>)}</dl>
        </Card>
        {admin && <Card icon={SmartToyRounded} tone="lavender" title="AI Provider 설정" subtitle="Local Rule · Ollama · OpenAI · Anthropic">
          <Stack spacing={2} sx={{ p: 2.25 }}>
            <TextField select label="Provider" value={provider} onChange={e => setProvider(e.target.value)}><MenuItem value="LOCAL">Local Rule (기본)</MenuItem><MenuItem value="OLLAMA">Ollama (로컬)</MenuItem><MenuItem value="OPENAI">OpenAI Responses API</MenuItem><MenuItem value="ANTHROPIC">Anthropic Claude</MenuItem></TextField>
            <TextField label="Ollama Endpoint" value={endpoint} disabled={provider !== 'OLLAMA'} onChange={e => setEndpoint(e.target.value)} helperText="보안을 위해 127.0.0.1 또는 localhost만 허용됩니다."/>
            <TextField label="Ollama Model" value={ollamaModel} disabled={provider !== 'OLLAMA'} onChange={e => setOllamaModel(e.target.value)}/>
            <TextField label="OpenAI Model" value={openaiModel} disabled={provider !== 'OPENAI'} onChange={e => setOpenaiModel(e.target.value)}/>
            <TextField label="Anthropic Model" value={anthropicModel} disabled={provider !== 'ANTHROPIC'} onChange={e => setAnthropicModel(e.target.value)}/>
            {(provider==='OPENAI'||provider==='ANTHROPIC')&&<Alert severity="warning">입력한 고장 제목·증상·서비스 영향의 마스킹된 최소 데이터가 외부 Provider로 전송되며 API 비용이 발생할 수 있습니다. 실제 군사기밀·개인정보·인증정보를 입력하지 마십시오. 결과는 담당자가 검토한 뒤에만 반영됩니다.</Alert>}
            <Stack direction={{xs:'column',sm:'row'}} spacing={1}><TextField label="Timeout(초)" type="number" value={timeoutSeconds} onChange={e=>setTimeoutSeconds(Number(e.target.value))} slotProps={{htmlInput:{min:5,max:30}}}/><TextField label="일일 외부 요청 한도" type="number" value={dailyLimit} onChange={e=>setDailyLimit(Number(e.target.value))} slotProps={{htmlInput:{min:1,max:1000}}}/></Stack>
            <FormControlLabel control={<Checkbox checked={externalEnabled} onChange={e=>setExternalEnabled(e.target.checked)}/>} label="외부 AI Provider 사용 활성화"/>
            <FormControlLabel control={<Checkbox checked={externalConsent} onChange={e=>setExternalConsent(e.target.checked)}/>} label="외부 전송·별도 비용·담당자 최종 판단 안내에 동의"/>
            {(['OPENAI','ANTHROPIC'] as const).map(kind=><Box key={kind} sx={{p:1.5,border:'1px solid var(--line)',borderRadius:2}}><Typography variant="subtitle2">{kind} API Key · {aiConfig?.credentials?.[kind]?.masked??'미설정'} ({aiConfig?.credentials?.[kind]?.source??'none'})</Typography><Stack direction="row" spacing={1} sx={{mt:1}}><TextField size="small" fullWidth type="password" label="새 API Key 저장/교체" value={kind==='OPENAI'?openaiKey:anthropicKey} onChange={e=>kind==='OPENAI'?setOpenaiKey(e.target.value):setAnthropicKey(e.target.value)} autoComplete="new-password"/><Button disabled={Boolean(aiBusy)} onClick={()=>saveKey(kind)}>저장</Button><Button color="error" disabled={Boolean(aiBusy)||!aiConfig?.credentials?.[kind]?.configured} onClick={()=>deleteKey(kind)}>삭제</Button><Button variant="outlined" disabled={Boolean(aiBusy)||!aiConfig?.credentials?.[kind]?.configured} onClick={()=>testProvider(kind)}>연결 시험</Button></Stack><Typography variant="caption" color="text.secondary">마지막 시험: {aiConfig?.lastTests?.[kind]?.status??'NOT_TESTED'} · {aiConfig?.lastTests?.[kind]?.at?fmtDateTime(aiConfig.lastTests[kind].at):'-'}</Typography></Box>)}
            <Stack direction="row" sx={{justifyContent:'space-between',alignItems:'center'}}><Typography variant="caption" color="text.secondary">Fallback: {aiConfig?.fallbackPolicy??'선택 Provider 실패 시 Local Rule'}</Typography><Stack direction="row" spacing={1}>{provider==='OLLAMA'&&<Button variant="outlined" disabled={Boolean(aiBusy)} onClick={()=>testProvider('OLLAMA')}>Ollama 연결 시험</Button>}<Button variant="contained" disabled={Boolean(aiBusy)} onClick={saveAi}>AI 설정 저장</Button></Stack></Stack>
          </Stack>
        </Card>}
      </div>
      {admin && <Card icon={HistoryRounded} tone="sky" title="운영 기준시간 · SLA" subtitle="평가 시연과 실제 운용 환경에 맞게 조정">
        <Stack direction="row" spacing={2} sx={{p:2.25,alignItems:'center'}}>
          <TextField label="계획 입력 기준" type="time" slotProps={{inputLabel:{shrink:true}}} value={planTime} onChange={e=>setPlanTime(e.target.value)}/>
          <TextField label="완료 현황 기준" type="time" slotProps={{inputLabel:{shrink:true}}} value={closeTime} onChange={e=>setCloseTime(e.target.value)}/>
          <TextField label="긴급 SLA(분)" type="number" slotProps={{htmlInput:{min:10}}} value={urgentSla} onChange={e=>setUrgentSla(Number(e.target.value))}/>
          <TextField label="일반 SLA(분)" type="number" slotProps={{htmlInput:{min:10}}} value={normalSla} onChange={e=>setNormalSla(Number(e.target.value))}/>
          <Button variant="outlined" onClick={()=>call('system:setOperationsSettings',{planTime,closeTime,urgentSlaMinutes:urgentSla,normalSlaMinutes:normalSla}).then(()=>alert('운영 기준시간과 SLA를 저장했습니다.')).catch(e=>alert(e.message))}>운영 설정 저장</Button>
        </Stack>
      </Card>}
      {admin && <Card icon={BackupRounded} tone="green" title="데이터 관리" subtitle="매일 첫 실행 시 자동 백업 · 최근 10개 보관">
        <Box className="data-actions">
          <Box><strong>수동 백업</strong><span>현재 데이터베이스를 백업 폴더에 즉시 저장합니다.</span></Box>
          <Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<FolderOpenRounded />} onClick={() => call('system:openDataFolder').catch(e => alert(e.message))}>데이터 폴더 열기</Button><Button variant="contained" startIcon={<BackupRounded />} onClick={() => call<string>('system:backup').then(v => alert(`백업: ${v}`)).catch(e => alert(e.message))}>DB 백업</Button></Stack>
        </Box>
        <Box className="danger-zone">
          <span className="ui-icon-tile tone-red"><WarningAmberRounded /></span>
          <Box sx={{ flex: 1 }}><strong>위험 구역 · Demo 데이터 초기화</strong><span>현재 데이터를 백업한 뒤 가상 시연 데이터 초기 상태로 되돌립니다. 입력한 데이터는 모두 사라집니다.</span></Box>
          <Button variant="outlined" color="error" onClick={() => setStep(1)}>Demo 데이터 초기화</Button>
        </Box>
      </Card>}
    </>}

    {tab === 1 && <Card icon={NotificationsNoneRounded} tone="orange" title="알림" subtitle={`전체 ${notifications.length}건 · 읽지 않음 ${unread}건`}>
      {notifications.length ? <Box>{notifications.map(n => <Box className={`notify ${n.read_at ? 'read' : ''}`} key={n.id}>
        <span className={`ui-icon-tile tone-${n.type === 'URGENT' ? 'red' : 'sky'}`}><ReportRounded /></span>
        <Box sx={{ flex: 1, minWidth: 0 }}><strong>{n.title}</strong><span>{n.body}</span></Box>
        <time>{fmtDateTime(n.created_at)}</time>
        {!n.read_at ? <Button size="small" onClick={() => call('system:markNotificationRead',{ id:n.id }).then(loadNotifications).catch(e => alert(e.message))}>읽음</Button> : <span className="notify-done">확인함</span>}
      </Box>)}</Box> : <EmptyState icon={NotificationsNoneRounded} title="알림이 없습니다" description="긴급 고장이 접수되면 이곳에 표시됩니다." />}
    </Card>}

    {tab === 2 && admin && <Card icon={HistoryRounded} tone="gray" title="감사 로그" subtitle={`최근 ${audit.length}건 · 데이터 변경 이력`}>
      <DataGrid rows={audit} columns={columns} density="compact" rowHeight={48} columnHeaderHeight={44} disableRowSelectionOnClick pageSizeOptions={[10,25,50]} initialState={{ pagination:{paginationModel:{pageSize:10,page:0}} }}/>
    </Card>}

    <Dialog open={step > 0} onClose={() => setStep(0)}>
      <DialogTitle>Demo 데이터 초기화 · {step}/2</DialogTitle>
      <DialogContent><Typography>{step === 1 ? '현재 데이터가 백업되고 가상 데이터 초기 상태로 돌아갑니다.' : '최종 확인: 사용자가 입력한 데이터가 초기화됩니다.'}</Typography></DialogContent>
      <DialogActions><Button onClick={() => setStep(0)}>취소</Button><Button color="error" variant={step === 2 ? 'contained' : 'text'} onClick={() => step === 1 ? setStep(2) : call('system:resetDemo',{ confirm:'RESET DEMO' }).then(() => { setStep(0); window.dispatchEvent(new Event('omnis:reset')) }).catch(e => alert(e.message))}>{step === 1 ? '다음':'초기화 실행'}</Button></DialogActions>
    </Dialog>
  </>
}
