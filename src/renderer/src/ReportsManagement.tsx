import { useEffect, useState } from 'react'
import { Box, Button, Tab, Tabs, TextField, Typography } from '@mui/material'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AssessmentRounded from '@mui/icons-material/AssessmentRounded'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import ReportProblemRounded from '@mui/icons-material/ReportProblemRounded'
import BuildRounded from '@mui/icons-material/BuildRounded'
import type { Channel, Result } from '../../shared/contracts'
import { Card, EmptyState, PageHeader, type Tone } from './ui'

type Row = Record<string, any>
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.omnis.invoke(channel,payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const statusMeta: Record<string, [string, Tone]> = { RECEIVED:['접수','sky'],TRIAGED:['분류','lavender'],ASSIGNED:['배정','sky'],PLANNED:['계획','sky'],IN_PROGRESS:['진행','orange'],RESOLVED:['조치완료','green'],CLOSED:['종결','gray'],CANCELED:['취소','red'],BLOCKED:['보류','red'],COMPLETED:['완료','green'] }

// 상태별 건수를 가로 막대로 — 막대 길이는 해당 목록의 최댓값 기준
function StatusBars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map(r => r.n))
  return <Box className="status-bars">{rows.map(r => { const [text, tone] = statusMeta[r.status] ?? [r.status, 'gray' as Tone]; return <Box key={r.status} className="status-bar-row">
    <span className="sb-label"><i className={`dot tone-${tone}`} />{text}</span>
    <span className="sb-track"><span className={`sb-fill tone-${tone}`} style={{ width: `${r.n / max * 100}%` }} /></span>
    <b>{r.n}건</b>
  </Box> })}</Box>
}

export default function ReportsManagement() {
  const [tab,setTab] = useState(0),[date,setDate] = useState(new Date().toISOString().slice(0,10)),[daily,setDaily] = useState<Row | null>(null),[weekly,setWeekly] = useState<Row | null>(null)
  const exportFile = (channel: Channel, payload: Record<string,unknown>) => call<string | null>(channel,payload).then(v => { if (v) alert(`저장됨: ${v}`) }).catch(e => alert(e.message))
  const query = () => tab === 0 ? call<Row>('reports:daily',{ date }).then(setDaily).catch(e => alert(e.message)) : call<Row>('reports:weekly',{ startDate:date }).then(setWeekly).catch(e => alert(e.message))
  useEffect(() => { query() }, [tab])
  const weeklyChart = weekly ? Array.from({length:7},(_,i) => { const d = new Date(`${weekly.startDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+i); const day = d.toISOString().slice(0,10); return { day:day.slice(5).replace('-','.'), incidents:weekly.incidents.find((r:Row) => r.day === day)?.n ?? 0, maintenance:weekly.maintenance.find((r:Row) => r.day === day)?.n ?? 0 } }) : []
  const sum = (rows: Row[] = []) => rows.reduce((s, r) => s + r.n, 0)
  return <>
    <PageHeader section="업무 지원" title="보고서 / 통계" description="일일·주간 운영 실적을 조회하고 CSV·PDF로 내보냅니다."
      actions={<><Button variant="outlined" startIcon={<FileDownloadOutlined />} onClick={() => exportFile('reports:exportCsv',{ kind:'incidents' })}>고장 CSV</Button><Button variant="outlined" startIcon={<FileDownloadOutlined />} onClick={() => exportFile('reports:exportCsv',{ kind:'maintenance' })}>정비 CSV</Button></>} />
    <Card icon={AssessmentRounded} tone="lavender" title="운영 보고서" subtitle={tab === 0 ? '선택한 날짜의 고장 접수·정비 예정 현황' : '시작일부터 7일간의 일별 추이'}>
      <Box className="ui-toolbar">
        <Tabs value={tab} onChange={(_,v) => setTab(v)} className="ui-seg-tabs"><Tab label="일일"/><Tab label="주간"/></Tabs>
        <span className="spacer" />
        <TextField label={tab === 0 ? '조회일':'시작일'} type="date" size="small" slotProps={{ inputLabel:{shrink:true} }} value={date} onChange={e => setDate(e.target.value)}/>
        <Button variant="contained" onClick={query}>조회</Button>
        {tab === 0 && <Button variant="outlined" startIcon={<PictureAsPdfOutlined />} onClick={() => exportFile('reports:exportPdf',{ date })}>일일 PDF</Button>}
      </Box>
      {tab === 0 && daily && <Box className="report-body">
        <Typography className="report-caption">{daily.date} 일일 현황</Typography>
        <Box className="report-grid">
          <Box className="report-block">
            <Box className="report-block-head"><span className="ui-icon-tile tone-red"><ReportProblemRounded /></span><Box><span className="dd-label">고장 접수</span><strong>{sum(daily.incidents)}<small>건</small></strong></Box></Box>
            {daily.incidents.length ? <StatusBars rows={daily.incidents} /> : <EmptyState icon={ReportProblemRounded} title="접수된 고장이 없습니다" />}
          </Box>
          <Box className="report-block">
            <Box className="report-block-head"><span className="ui-icon-tile tone-orange"><BuildRounded /></span><Box><span className="dd-label">정비 예정</span><strong>{sum(daily.maintenance)}<small>건</small></strong></Box></Box>
            {daily.maintenance.length ? <StatusBars rows={daily.maintenance} /> : <EmptyState icon={BuildRounded} title="예정된 정비가 없습니다" />}
          </Box>
        </Box>
      </Box>}
      {tab === 1 && weekly && <Box className="report-body">
        <Typography className="report-caption">기간: {weekly.startDate} ~ {weekly.endDate} 전일</Typography>
        <Box className="report-kpis">
          <Box><span className="dd-label">고장 접수 합계</span><strong>{sum(weekly.incidents)}<small>건</small></strong></Box>
          <Box><span className="dd-label">정비 예정 합계</span><strong>{sum(weekly.maintenance)}<small>건</small></strong></Box>
          <Box><span className="dd-label">일평균 고장</span><strong>{(sum(weekly.incidents) / 7).toFixed(1)}<small>건</small></strong></Box>
        </Box>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={weeklyChart} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" vertical={false}/>
            <XAxis dataKey="day" tick={{ fill:'#a3a9b8', fontSize:11 }} axisLine={{ stroke:'#e6e9f0' }} tickLine={false}/>
            <YAxis allowDecimals={false} width={28} tick={{ fill:'#a3a9b8', fontSize:11 }} axisLine={false} tickLine={false}/>
            <Tooltip cursor={{ fill:'rgba(35,46,107,.04)' }} contentStyle={{ borderRadius:12, border:0, boxShadow:'0 10px 30px -10px rgba(35,46,107,.25)', fontSize:12 }}/>
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} formatter={v => <span style={{ color:"#5c6275" }}>{v}</span>}/>
            <Bar dataKey="incidents" fill="#232e6b" name="고장" radius={[6,6,0,0]} maxBarSize={28}/>
            <Bar dataKey="maintenance" fill="#2fb872" name="정비" radius={[6,6,0,0]} maxBarSize={28}/>
          </BarChart>
        </ResponsiveContainer>
      </Box>}
    </Card>
  </>
}
