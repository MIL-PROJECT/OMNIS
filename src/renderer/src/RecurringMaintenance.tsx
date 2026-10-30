import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import type { PublicUser } from '../../shared/contracts'
import {
  type Recurrence,
  type RecurringRule,
  type WorkTemplate
} from '../../shared/usability'
import { koreaDate } from '../../shared/date'
import { invoke } from './usabilityApi'

type Preview = {
  rule: RecurringRule
  items: { date: string; existing: boolean; closed: boolean; past: boolean }[]
}
type Person = { id: string; display_name: string; role: string }
export default function RecurringMaintenance({
  user,
  onCreated
}: {
  user: PublicUser
  onCreated: () => void
}) {
  const [rules, setRules] = useState<RecurringRule[]>([]),
    [people, setPeople] = useState<Person[]>([]),
    [templates, setTemplates] = useState<WorkTemplate[]>([]),
    [systems, setSystems] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState<{
      id?: string
      version?: number
      active: boolean
      definition: Recurrence
    } | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [allowPast, setAllowPast] = useState(false),
    [range, setRange] = useState({
      from: koreaDate(),
      to: new Date(Date.parse(`${koreaDate()}T00:00:00Z`) + 29 * 86400000)
        .toISOString()
        .slice(0, 10)
    }),
    [activeRule, setActiveRule] = useState<RecurringRule | null>(null)
  const load = () => invoke<RecurringRule[]>('recurring:list').then(setRules)
  useEffect(() => {
    load().catch((e) => setError(e.message))
    invoke<Person[]>('users:list').then(setPeople)
    invoke<WorkTemplate[]>('templates:list', { kind: 'CHECKLIST' }).then(
      setTemplates
    )
    invoke<{ id: string; name: string }[]>('operations:list').then(setSystems)
  }, [])
  const blank = (): Recurrence => ({
    title: '',
    maintenanceType: '정기점검',
    department: user.unit_name ?? '가상 정비반',
    priority: 'NORMAL',
    description: '',
    systemId: null,
    assigneeId: user.id,
    checklistTemplateId: 'check-general',
    startDate: koreaDate(),
    endDate: null,
    frequency: 'WEEKLY',
    interval: 1,
    weekdays: [1],
    monthDay: 1,
    lastDay: false
  })
  const set = <K extends keyof Recurrence>(key: K, value: Recurrence[K]) =>
    setForm((f) =>
      f ? { ...f, definition: { ...f.definition, [key]: value } } : f
    )
  const perform = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const openPreview = async (rule: RecurringRule) => {
    setActiveRule(rule)
    setPreview(null)
    setSelected([])
    setAllowPast(false)
    setPreview(
      await invoke<Preview>('recurring:preview', {
        id: rule.id,
        version: rule.version,
        ...range
      })
    )
  }
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Alert severity="info">
        미리보기 후 선택한 작업만 생성합니다. 규칙 변경·중지는 이미 생성된
        작업에 영향을 주지 않습니다.
      </Alert>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          type="date"
          label="미리보기 시작"
          slotProps={{ inputLabel: { shrink: true } }}
          value={range.from}
          onChange={(e) => {
            setRange((v) => ({ ...v, from: e.target.value }))
            setPreview(null)
          }}
        />
        <TextField
          type="date"
          label="미리보기 종료"
          slotProps={{ inputLabel: { shrink: true } }}
          value={range.to}
          onChange={(e) => {
            setRange((v) => ({ ...v, to: e.target.value }))
            setPreview(null)
          }}
        />
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => {
            setError('')
            setForm({ active: true, definition: blank() })
          }}
        >
          반복 규칙 등록
        </Button>
      </Stack>
      {!rules.length && (
        <Typography color="text.secondary">
          등록된 반복 규칙이 없습니다.
        </Typography>
      )}
      {rules.map((rule) => (
        <Stack
          key={rule.id}
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            p: 1.5,
            border: '1px solid var(--line)',
            borderRadius: 2,
            alignItems: { sm: 'center' }
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2">{rule.definition.title}</Typography>
            <Typography variant="caption">
              {rule.definition.frequency === 'WEEKLY'
                ? `${rule.definition.interval}주마다`
                : `${rule.definition.interval}개월마다`}{' '}
              ·{' '}
              {people.find((p) => p.id === rule.definition.assigneeId)
                ?.display_name ?? '담당자 확인 필요'}{' '}
              · {rule.active ? '사용 중' : '중지'} · v{rule.version}
            </Typography>
          </Box>
          <Button
            disabled={busy}
            onClick={() => setForm(structuredClone(rule))}
          >
            수정
          </Button>
          <Button
            variant="outlined"
            disabled={busy || !rule.active}
            onClick={() => perform(() => openPreview(rule))}
          >
            일정 미리보기
          </Button>
          <Button
            color="error"
            disabled={busy}
            onClick={() => {
              if (confirm('반복 규칙을 삭제할까요? 기존 작업은 유지됩니다.'))
                perform(async () => {
                  await invoke('recurring:delete', {
                    id: rule.id,
                    version: rule.version
                  })
                  setPreview(null)
                  await load()
                })
            }}
          >
            삭제
          </Button>
        </Stack>
      ))}
      {preview && (
        <Box sx={{ p: 2, border: '1px solid var(--line)', borderRadius: 2 }}>
          <Typography variant="subtitle2">
            {preview.rule.definition.title} · 생성 미리보기{' '}
            {preview.items.length}건
          </Typography>
          <Typography variant="caption">
            담당자:{' '}
            {
              people.find((p) => p.id === preview.rule.definition.assigneeId)
                ?.display_name
            }{' '}
            · {preview.rule.definition.maintenanceType} · 점검표:{' '}
            {templates.find(
              (t) => t.id === preview.rule.definition.checklistTemplateId
            )?.definition.title ?? '없음'}
          </Typography>
          <Stack>
            {preview.items.map((i) => (
              <FormControlLabel
                key={i.date}
                control={
                  <Checkbox
                    checked={selected.includes(i.date)}
                    disabled={busy || i.existing || i.closed}
                    onChange={(e) =>
                      setSelected((v) =>
                        e.target.checked
                          ? [...v, i.date]
                          : v.filter((d) => d !== i.date)
                      )
                    }
                  />
                }
                label={`${i.date} · ${i.existing ? '이미 생성됨 (건너뜀)' : i.closed ? '마감됨 (생성 불가)' : i.past ? '과거 일정' : '생성 가능'}`}
              />
            ))}
          </Stack>
          {!preview.items.length && (
            <Typography>범위 내 일정이 없습니다.</Typography>
          )}
          <Button
            disabled={busy}
            onClick={() =>
              setSelected(
                preview.items
                  .filter((i) => !i.existing && !i.closed)
                  .map((i) => i.date)
              )
            }
          >
            생성 가능 일정 모두 선택
          </Button>
          <FormControlLabel
            control={
              <Checkbox
                checked={allowPast}
                onChange={(e) => setAllowPast(e.target.checked)}
              />
            }
            label="선택한 과거 일정도 생성 확인"
          />
          <Button
            variant="contained"
            disabled={busy || !selected.length}
            onClick={() =>
              perform(async () => {
                const result = await invoke<{
                  created: unknown[]
                  skipped: string[]
                }>('recurring:generate', {
                  id: preview.rule.id,
                  version: preview.rule.version,
                  ...range,
                  dates: selected,
                  allowPast
                })
                setMessage(
                  `생성 ${result.created.length}건 · 기존 회차 건너뜀 ${result.skipped.length}건`
                )
                onCreated()
                if (activeRule) await openPreview(activeRule)
              })
            }
          >
            선택 작업 {selected.length}건 생성
          </Button>
        </Box>
      )}
      <Dialog
        open={!!form}
        onClose={() => !busy && setForm(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {form?.id ? '반복 규칙 수정' : '반복 규칙 등록'}
        </DialogTitle>
        <DialogContent dividers>
          {form && (
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="반복 작업명"
                value={form.definition.title}
                onChange={(e) => set('title', e.target.value)}
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  label="정비 유형"
                  value={form.definition.maintenanceType}
                  onChange={(e) => set('maintenanceType', e.target.value)}
                />
                <TextField
                  label="부서"
                  value={form.definition.department}
                  onChange={(e) => set('department', e.target.value)}
                />
              </Stack>
              <TextField
                select
                label="담당자"
                value={form.definition.assigneeId}
                onChange={(e) => set('assigneeId', e.target.value)}
              >
                {people
                  .filter(
                    (p) =>
                      ['ADMIN', 'MAINTAINER'].includes(p.role) &&
                      (user.role === 'ADMIN' || p.id === user.id)
                  )
                  .map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.display_name}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                select
                label="대상 체계"
                value={form.definition.systemId ?? ''}
                onChange={(e) => set('systemId', e.target.value || null)}
              >
                <MenuItem value="">미지정</MenuItem>
                {systems.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="체크리스트"
                value={form.definition.checklistTemplateId ?? ''}
                onChange={(e) =>
                  set('checklistTemplateId', e.target.value || null)
                }
              >
                <MenuItem value="">없음</MenuItem>
                {templates.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.definition.title}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="우선순위"
                value={form.definition.priority}
                onChange={(e) =>
                  set('priority', e.target.value as Recurrence['priority'])
                }
              >
                <MenuItem value="NORMAL">일반</MenuItem>
                <MenuItem value="HIGH">높음</MenuItem>
              </TextField>
              <TextField
                multiline
                label="작업 설명"
                value={form.definition.description}
                onChange={(e) => set('description', e.target.value)}
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  type="date"
                  label="시작일"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={form.definition.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                />
                <TextField
                  type="date"
                  label="종료일 (선택)"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={form.definition.endDate ?? ''}
                  onChange={(e) => set('endDate', e.target.value || null)}
                />
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField
                  select
                  label="반복 주기"
                  sx={{ flex: 1 }}
                  value={form.definition.frequency}
                  onChange={(e) =>
                    set('frequency', e.target.value as Recurrence['frequency'])
                  }
                >
                  <MenuItem value="WEEKLY">매주</MenuItem>
                  <MenuItem value="MONTHLY">매월</MenuItem>
                </TextField>
                <TextField
                  type="number"
                  label={
                    form.definition.frequency === 'WEEKLY'
                      ? '몇 주마다'
                      : '몇 개월마다'
                  }
                  value={form.definition.interval}
                  slotProps={{ htmlInput: { min: 1, max: 12 } }}
                  onChange={(e) => set('interval', Number(e.target.value))}
                />
              </Stack>
              {form.definition.frequency === 'WEEKLY' ? (
                <Box>
                  {['월', '화', '수', '목', '금', '토', '일'].map(
                    (label, i) => (
                      <FormControlLabel
                        key={label}
                        label={label}
                        control={
                          <Checkbox
                            checked={form.definition.weekdays.includes(i + 1)}
                            onChange={(e) =>
                              set(
                                'weekdays',
                                e.target.checked
                                  ? [...form.definition.weekdays, i + 1]
                                  : form.definition.weekdays.filter(
                                      (n) => n !== i + 1
                                    )
                              )
                            }
                          />
                        }
                      />
                    )
                  )}
                </Box>
              ) : (
                <>
                  <FormControlLabel
                    label="매월 마지막 날"
                    control={
                      <Checkbox
                        checked={form.definition.lastDay}
                        onChange={(e) => set('lastDay', e.target.checked)}
                      />
                    }
                  />
                  <TextField
                    type="number"
                    label="기준 일자"
                    disabled={form.definition.lastDay}
                    value={form.definition.monthDay}
                    slotProps={{ htmlInput: { min: 1, max: 31 } }}
                    onChange={(e) => set('monthDay', Number(e.target.value))}
                  />
                  <Typography variant="caption">
                    31일이 없는 달은 말일에 생성하고 다음 달에는 원래 일자로
                    복귀합니다.
                  </Typography>
                </>
              )}
              <FormControlLabel
                label="반복 규칙 사용"
                control={
                  <Checkbox
                    checked={form.active}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                  />
                }
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setForm(null)}>
            취소
          </Button>
          <Button
            variant="contained"
            disabled={busy || !form}
            onClick={() =>
              perform(async () => {
                if (!form) return
                await invoke('recurring:save', form)
                setForm(null)
                setPreview(null)
                await load()
                setMessage(
                  '반복 규칙을 저장했습니다. 일정을 미리본 뒤 생성하십시오.'
                )
              })
            }
          >
            규칙 저장
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
