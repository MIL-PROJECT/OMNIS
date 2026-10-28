import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import {
  type CheckResult,
  type TaskChecklist,
  type WorkTemplate
} from '../../shared/usability'
import { invoke } from './usabilityApi'
import { fmtDateTime } from './ui'

export default function TaskChecklistPanel({
  taskId,
  editable,
  onChanged
}: {
  taskId: string
  editable: boolean
  onChanged: () => void
}) {
  const [check, setCheck] = useState<TaskChecklist | null>(null),
    [results, setResults] = useState<CheckResult[]>([]),
    [templates, setTemplates] = useState<WorkTemplate[]>([]),
    [choice, setChoice] = useState('check-general'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false)
  useEffect(() => {
    let alive = true
    setCheck(null)
    setResults([])
    setDirty(false)
    Promise.all([
      invoke<TaskChecklist | null>('checklist:get', { taskId }),
      invoke<WorkTemplate[]>('templates:list', { kind: 'CHECKLIST' })
    ])
      .then(([v, t]) => {
        if (alive) {
          setCheck(v)
          setResults(v?.results ?? [])
          setTemplates(t)
          if (t.length && !t.some((x) => x.id === choice)) setChoice(t[0].id)
        }
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [taskId])
  const patch = (id: string, value: Partial<CheckResult>) => {
    setDirty(true)
    setMessage('')
    setResults((rows) => {
      const old = rows.find((r) => r.id === id) ?? {
        id,
        status: 'PENDING' as const,
        note: ''
      }
      return [...rows.filter((r) => r.id !== id), { ...old, ...value }]
    })
  }
  const done =
    check?.items.filter((i) => {
      const r = results.find((r) => r.id === i.id)
      return r && r.status !== 'PENDING'
    }).length ?? 0
  const requiredMissing =
    check?.items.filter(
      (i) =>
        i.required &&
        !results.some(
          (r) =>
            r.id === i.id &&
            (r.status === 'OK' ||
              (r.status === 'NA' && i.allowNa && r.note.trim()))
        )
    ).length ?? 0
  const perform = async (
    fn: () => Promise<TaskChecklist | null>,
    text: string
  ) => {
    setBusy(true)
    setError('')
    try {
      const v = await fn()
      setCheck(v)
      setResults(v?.results ?? [])
      setDirty(false)
      setMessage(text)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack
      spacing={1.5}
      sx={{ my: 2, p: 2, border: '1px solid var(--line)', borderRadius: 2 }}
      data-testid="task-checklist"
    >
      <Typography variant="subtitle2">
        점검 항목 {check ? `· ${check.title}` : ''}
      </Typography>
      {error && (
        <Alert severity="error">
          {error}
          <Button
            size="small"
            onClick={() =>
              invoke<TaskChecklist | null>('checklist:get', { taskId })
                .then((v) => {
                  if (
                    confirm('현재 입력 대신 저장된 점검표를 다시 불러올까요?')
                  ) {
                    setCheck(v)
                    setResults(v?.results ?? [])
                    setDirty(false)
                    setError('')
                  }
                })
                .catch((e) => setError(e.message))
            }
          >
            저장본 다시 불러오기
          </Button>
        </Alert>
      )}
      {message && <Alert severity="success">{message}</Alert>}
      {check ? (
        <>
          <Typography variant="caption">
            {check.items.length}개 중 {done}개 점검 · 필수 {requiredMissing}개
            미완료 · 정비 진행률과 별도
            {dirty ? ' · 저장하지 않은 변경 있음' : ''}
          </Typography>
          {check.items.map((item) => {
            const r = results.find((r) => r.id === item.id),
              saved = check.results.find((r) => r.id === item.id)
            return (
              <Box
                key={item.id}
                sx={{ borderBottom: '1px solid var(--line)', pb: 1 }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ alignItems: { sm: 'center' } }}
                >
                  <Typography sx={{ flex: 1, fontSize: 13 }}>
                    {item.label} · {item.required ? '필수' : '선택'}
                  </Typography>
                  <TextField
                    select
                    size="small"
                    label={`${item.label} 결과`}
                    sx={{ minWidth: 140 }}
                    disabled={!editable || busy}
                    value={r?.status ?? 'PENDING'}
                    onChange={(e) =>
                      patch(item.id, {
                        status: e.target.value as CheckResult['status']
                      })
                    }
                  >
                    <MenuItem value="PENDING">미확인</MenuItem>
                    <MenuItem value="OK">정상</MenuItem>
                    <MenuItem value="ISSUE">이상</MenuItem>
                    {item.allowNa && <MenuItem value="NA">해당 없음</MenuItem>}
                  </TextField>
                </Stack>
                <TextField
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                  label={`${item.label} 메모`}
                  placeholder="이상/해당 없음 선택 시 사유를 입력하십시오."
                  disabled={!editable || busy}
                  value={r?.note ?? ''}
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                  onChange={(e) => patch(item.id, { note: e.target.value })}
                />
                {saved?.at && (
                  <Typography variant="caption">
                    확인 시각 {fmtDateTime(saved.at)}
                  </Typography>
                )}
              </Box>
            )
          })}
          {editable && (
            <Button
              variant="outlined"
              disabled={busy || !dirty}
              onClick={() =>
                perform(
                  () =>
                    invoke<TaskChecklist>('checklist:save', {
                      taskId,
                      revision: check.revision,
                      results
                    }),
                  '점검 결과를 저장했습니다.'
                )
              }
            >
              점검 결과 저장
            </Button>
          )}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          연결된 점검표가 없습니다. 기존 결과 입력 방식으로 완료할 수 있습니다.
        </Typography>
      )}
      {editable && (
        <Stack direction="row" spacing={1}>
          <TextField
            select
            size="small"
            label="점검표 선택"
            value={templates.some((t) => t.id === choice) ? choice : ''}
            onChange={(e) => setChoice(e.target.value)}
            sx={{ flex: 1 }}
          >
            {templates.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.definition.title}
              </MenuItem>
            ))}
          </TextField>
          <Button
            disabled={busy || !choice}
            onClick={() => {
              if (
                (check || dirty) &&
                !confirm(
                  '점검표를 교체하면 현재 결과가 초기화됩니다. 계속할까요?'
                )
              )
                return
              perform(
                () =>
                  invoke<TaskChecklist>('checklist:attach', {
                    taskId,
                    templateId: choice,
                    expectedRevision: check?.revision ?? 0,
                    replaceConfirmed: Boolean(check)
                  }),
                '점검표를 연결했습니다.'
              )
            }}
          >
            {check ? '점검표 교체' : '점검표 추가'}
          </Button>
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary">
        필수 미확인·이상 항목은 작업 완료 전에 정상 확인해야 합니다. 시연용 일반
        점검 안내입니다.
      </Typography>
    </Stack>
  )
}
