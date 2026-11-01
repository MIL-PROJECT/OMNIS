import type Database from 'better-sqlite3'
import { incidentSeverityLabel, reportStatusLabel } from '../../shared/reportLabels'

export function dailyReportIncidents(db:Database.Database,date:string):Record<string,unknown>[] {
  return db.prepare("SELECT ticket_no,title,severity,status FROM incidents WHERE date(reported_at,'+9 hours')=? ORDER BY reported_at,id").all(date) as Record<string,unknown>[]
}

export function dailyReportHtml(date:string,rows:readonly Record<string,unknown>[]):string {
  const escape=(value:unknown)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
  return `<html lang="ko"><head><meta charset="utf-8"><title>OMNIS 일일 고장 현황</title><style>
    body{font:12px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans CJK KR",sans-serif;padding:24px}
    table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid #aaa;padding:6px;text-align:left;overflow-wrap:anywhere}
    thead{display:table-header-group}tr{break-inside:avoid}
  </style></head><body><h1>OMNIS 일일 고장 현황</h1><p>${escape(date)} · 가상 시연 데이터</p>
    <table><colgroup><col style="width:28%"><col style="width:42%"><col style="width:12%"><col style="width:18%"></colgroup>
    <thead><tr><th>접수번호</th><th>제목</th><th>중요도</th><th>상태</th></tr></thead><tbody>
    ${rows.length?rows.map(row=>`<tr><td>${escape(row.ticket_no)}</td><td>${escape(row.title)}</td><td>${escape(incidentSeverityLabel(row.severity))}</td><td>${escape(reportStatusLabel(row.status))}</td></tr>`).join(''):'<tr><td colspan="4">해당 날짜의 고장 접수가 없습니다.</td></tr>'}
    </tbody></table></body></html>`
}
