import { describe, expect, it } from 'vitest'
import { incidentStatusSchema, maintenanceStatusSchema } from '../../src/shared/contracts'
import { incidentSeverityLabel, reportStatusLabel } from '../../src/shared/reportLabels'
import { dailyReportHtml } from '../../src/main/services/DailyReport'

describe('Korean daily report',()=>{
  it('covers every valid incident and maintenance status with Korean labels',()=>{
    for(const status of [...incidentStatusSchema.options,...maintenanceStatusSchema.options]){
      expect(reportStatusLabel(status)).toMatch(/[가-힣]/)
      expect(reportStatusLabel(status)).not.toBe('확인필요')
    }
    expect(incidentSeverityLabel('NORMAL')).toBe('일반');expect(incidentSeverityLabel('URGENT')).toBe('긴급')
    expect(reportStatusLabel('REMOTE_IN_PROGRESS')).toBe('원격조치')
    expect(reportStatusLabel('ON_SITE_IN_PROGRESS')).toBe('현장출동')
  })
  it('prints Korean cells and escapes user content without changing its visible meaning',()=>{
    const html=dailyReportHtml('2026-11-01',[{ticket_no:'INC-1',title:'회선 <점검> & "확인"',severity:'NORMAL',status:'REMOTE_IN_PROGRESS'}])
    expect(html).toContain('<td>일반</td>');expect(html).toContain('<td>원격조치</td>')
    expect(html).not.toContain('REMOTE_IN_PROGRESS');expect(html).not.toContain('<점검>')
    expect(html).toContain('회선 &lt;점검&gt; &amp; &quot;확인&quot;')
  })
  it('handles empty reports and unexpected stored codes without exposing technical enums',()=>{
    expect(dailyReportHtml('2026-11-01',[])).toContain('해당 날짜의 고장 접수가 없습니다.')
    const html=dailyReportHtml('2026-11-01',[{severity:'UNKNOWN',status:'UNKNOWN'}])
    expect(html).toContain('확인필요');expect(html).not.toContain('UNKNOWN')
  })
})
