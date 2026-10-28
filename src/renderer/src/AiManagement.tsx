import { useState } from 'react'
import { Box, Button, Dialog, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import InsightsRounded from '@mui/icons-material/InsightsRounded'
import BuildRounded from '@mui/icons-material/BuildRounded'
import TravelExploreRounded from '@mui/icons-material/TravelExploreRounded'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import type { Channel, Result } from '../../shared/contracts'
import StatusChip from './StatusChip'
import { Card, EmptyState, Meter, PageHeader, Paged } from './ui'

type Row = Record<string, any>
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.omnis.invoke(channel,payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const statusText: Record<string,string> = { RECEIVED:'접수',TRIAGED:'분류',ASSIGNED:'배정',PLANNED:'계획',IN_PROGRESS:'진행',RESOLVED:'조치완료',CLOSED:'종결',CANCELED:'취소',BLOCKED:'보류',COMPLETED:'완료' }
const similarColumns: GridColDef[] = [
  { field:'ticket_no',headerName:'접수번호',width:160,renderCell:({row}) => <span className="cell-code">{row.ticket_no}</span> },
  { field:'title',headerName:'유사 고장',flex:1,renderCell:({row}) => <span className="cell-strong">{row.title}</span> },
  { field:'action_summary',headerName:'조치 내용',flex:1,renderCell:({row}) => <span className="cell-muted">{row.action_summary || '-'}</span> },
  { field:'status',headerName:'상태',width:100,renderCell:({row}) => <StatusChip code={row.status} label={statusText[row.status] ?? row.status}/> }
]
const recommendationColumns: GridColDef[] = [
  { field:'task_no',headerName:'작업번호',width:150,renderCell:({row}) => <span className="cell-code">{row.task_no}</span> },
  { field:'title',headerName:'추천 정비 작업',flex:1,renderCell:({row}) => <span className="cell-strong">{row.title}</span> },
  { field:'priority',headerName:'우선순위',width:90,renderCell:({row}) => <StatusChip code={row.priority} label={row.priority === 'HIGH' ? '높음' : '일반'} tone={row.priority === 'HIGH' ? 'red' : 'gray'}/> },
  { field:'scheduled_date',headerName:'예정일',width:110,renderCell:({row}) => <span className="cell-muted">{row.scheduled_date}</span> }
]
const runColumns:GridColDef[]=[{field:'created_at',headerName:'실행 시각',width:180},{field:'feature',headerName:'기능',width:190},{field:'selected_provider',headerName:'선택',width:100},{field:'provider',headerName:'실제 사용',width:100},{field:'model',headerName:'Model',flex:1,minWidth:160},{field:'latency_ms',headerName:'응답(ms)',width:100},{field:'input_tokens',headerName:'입력 Token',width:100},{field:'output_tokens',headerName:'출력 Token',width:100},{field:'fallback_used',headerName:'Fallback',width:90,renderCell:({value})=>value?'예':'아니오'}]

export default function AiManagement() {
  const [title,setTitle] = useState(''),[description,setDescription] = useState(''),[result,setResult] = useState<Row | null>(null),[similar,setSimilar] = useState<Row[] | null>(null),[similarMeta,setSimilarMeta]=useState<Row|null>(null),[summary,setSummary] = useState<Row|null>(null),[recommendations,setRecommendations] = useState<Row[] | null>(null),[recommendationMeta,setRecommendationMeta]=useState<Row|null>(null),[busy,setBusy]=useState(''),[runs,setRuns]=useState<Row[]|null>(null)
  const analyze = async() => { if(busy)return;setBusy('analysis');try{const jobs:[Promise<Row>,Promise<Row>|null]=[call<Row>('ai:triageIncident',{title,description}),title.length>=3?call<Row>('ai:similarIncidents',{title}):null];const [analysis,matches]=await Promise.all([jobs[0],jobs[1]]);setResult(analysis);if(matches){setSimilar(matches.items);setSimilarMeta(matches)}}catch(e){alert((e as Error).message)}finally{setBusy('')} }
  const metadata=(value:Row|null)=>value?<Typography variant="caption" color="text.secondary">{value.provider} · {value.model} · {value.latencyMs ?? 0}ms · {value.fallbackUsed?'Local Rule fallback':'선택 Provider 사용'} · 외부 전송 {value.externalTransmission?'예':'아니오'}</Typography>:null
  // 한 화면 배치: 2×2 카드가 창 높이를 나눠 갖고, 목록은 Paged, 긴 본문은 카드 안에서 스크롤
  const grid = { rowHeight: 36, columnHeaderHeight: 36, hideFooter: true, autoHeight: true, disableColumnMenu: true, sx: { minHeight: 0 } } as const
  return <div className="dash ai-dash">
    <PageHeader section="업무 지원" title="AI 지원" description="로컬 규칙 기반으로 고장을 분류하고 유사 사례와 정비 우선순위를 제안합니다." />
    <Box className="ai-notice"><InfoOutlined /><span>AI 추천은 참고용입니다. 고장 상태나 우선순위는 자동으로 변경되지 않으며, 최종 판단은 담당자가 합니다.</span><Button size="small" variant="outlined" onClick={()=>call<Row[]>('ai:listRuns',{limit:50}).then(setRuns).catch(e=>alert(e.message))}>AI 실행 이력</Button></Box>
    <div className="dashboard-grid">
      <Card icon={AutoAwesomeRounded} tone="lavender" title="고장 분석" subtitle="제목과 내용으로 분류·우선순위 추천">
        <Stack spacing={1.5} className="ui-card-scroll" sx={{ p: 2 }}>
          <TextField label="제목" placeholder="예: 무선 통신 장애" value={title} onChange={e => setTitle(e.target.value)}/>
          <TextField label="내용" multiline rows={3} placeholder="증상, 발생 위치, 영향 범위를 입력하십시오." value={description} onChange={e => setDescription(e.target.value)}/>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" startIcon={<AutoAwesomeRounded />} disabled={!title.trim()||Boolean(busy)} onClick={analyze}>분석 및 유사 고장 조회</Button></Box>
          {result && <Box className="ai-result">
            <Box className="ai-result-head"><span className="dd-label">AI 추천 · {result.provider}{result.fallbackUsed ? ' (대체 규칙)' : ''}</span></Box>
            <Box className="stat-row">
              <Box><span className="dd-label">분류</span><span className="dd-value">{result.category}</span></Box>
              <Box><span className="dd-label">우선순위</span><StatusChip code={result.priority} label={result.priority === 'URGENT' ? '긴급' : '일반'} tone={result.priority === 'URGENT' ? 'red' : 'gray'}/></Box>
              <Box sx={{ flex: 1.6 }}><span className="dd-label">신뢰도</span><Meter value={Math.round(result.confidence * 100)} tone="lavender" /></Box>
            </Box>
            <Typography className="dd-text" sx={{ mt: 1.5 }}>{result.recommendation}</Typography>
            <Typography className="dd-text" sx={{ mt: 1 }}><strong>근거:</strong> {result.rationale}</Typography>
            {metadata(result)}
            <Typography variant="caption" sx={{display:'block'}}>담당자 검토 전에는 업무 데이터에 반영되지 않습니다.</Typography>
          </Box>}
        </Stack>
      </Card>
      <Card icon={InsightsRounded} tone="sky" title="일일 요약" subtitle="DB 집계값만 사용한 운영 현황 요약" action={<Button variant="outlined" size="small" disabled={Boolean(busy)} onClick={async()=>{setBusy('summary');try{setSummary(await call<Row>('ai:dailySummary'))}catch(e){alert((e as Error).message)}finally{setBusy('')}}}>일일 요약 생성</Button>}>
        <Box className="ui-card-scroll">
          {summary ? <Box className="ai-summary"><AutoAwesomeRounded /><Box><Typography>{summary.summary}</Typography>{metadata(summary)}</Box></Box>
            : <EmptyState icon={InsightsRounded} title="아직 생성된 요약이 없습니다" description="일일 요약 생성을 누르면 오늘의 미처리 현황을 요약합니다." />}
        </Box>
      </Card>
      <Card icon={TravelExploreRounded} tone="gray" title="유사 고장" subtitle={similar ? `${similar.length}건 발견` : '고장 분석 시 함께 조회됩니다'}>
        {similar?.length ? <Box sx={{px:2,pb:1}}>{metadata(similarMeta)}<Paged rows={similar.map((r,i) => ({...r,id:i}))} rowHeight={36} reserved={56}>{rows => <DataGrid {...grid} rows={rows} columns={similarColumns}/>}</Paged></Box>
          : <Box className="ui-card-scroll"><EmptyState icon={TravelExploreRounded} title={similar ? '유사한 과거 고장이 없습니다' : '분석 결과가 여기에 표시됩니다'} description="제목의 주요 단어가 겹치는 과거 접수 건과 조치 내용을 보여줍니다." /></Box>}
      </Card>
      <Card icon={BuildRounded} tone="orange" title="정비 우선순위 추천" subtitle="예정·진행·보류 작업 중 우선 처리 대상" action={<Button variant="outlined" size="small" disabled={Boolean(busy)} onClick={async()=>{setBusy('maintenance');try{const r=await call<Row>('ai:maintenanceRecommendations');setRecommendations(r.items);setRecommendationMeta(r)}catch(e){alert((e as Error).message)}finally{setBusy('')}}}>정비 우선순위 조회</Button>}>
        {recommendations?.length ? <Box sx={{px:2,pb:1}}>{metadata(recommendationMeta)}<Paged rows={recommendations} rowHeight={36} reserved={56}>{rows => <DataGrid {...grid} rows={rows} columns={recommendationColumns}/>}</Paged></Box>
          : <Box className="ui-card-scroll"><EmptyState icon={BuildRounded} title={recommendations ? '추천할 작업이 없습니다' : '조회 전입니다'} description="우선순위와 예정일을 기준으로 먼저 처리할 작업을 제안합니다." /></Box>}
      </Card>
    </div>
    <Dialog open={runs!==null} onClose={()=>setRuns(null)} fullWidth maxWidth="lg"><DialogTitle>AI 실행 이력</DialogTitle><DialogContent>{runs&&<DataGrid rows={runs} columns={runColumns} density="compact" disableRowSelectionOnClick pageSizeOptions={[10,25,50]} initialState={{pagination:{paginationModel:{page:0,pageSize:10}}}}/>}</DialogContent></Dialog>
  </div>
}
