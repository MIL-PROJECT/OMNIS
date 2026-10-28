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
import { type WorkTemplate } from '../../shared/usability'
import { invoke } from './usabilityApi'

export default function TemplateManagement() {
  const [kind, setKind] = useState<'INCIDENT' | 'CHECKLIST'>('INCIDENT'),
    [rows, setRows] = useState<WorkTemplate[]>([]),
    [form, setForm] = useState<WorkTemplate | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const load = () =>
    invoke<WorkTemplate[]>('templates:list', { kind, includeInactive: true })
      .then(setRows)
      .catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [kind])
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <TextField
        select
        label="템플릿 종류"
        value={kind}
        onChange={(e) => setKind(e.target.value as typeof kind)}
      >
        <MenuItem value="INCIDENT">고장 접수</MenuItem>
        <MenuItem value="CHECKLIST">정비 점검표</MenuItem>
      </TextField>
      {error && <Alert severity="error">{error}</Alert>}
      {rows.map((t) => (
        <Stack
          key={t.id}
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            p: 1.5,
            border: '1px solid var(--line)',
            borderRadius: 2
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2">{t.definition.title}</Typography>
            <Typography variant="caption">
              v{t.version} · {t.active ? '사용 중' : '사용 중지'}
            </Typography>
          </Box>
          <Button
            onClick={() => {
              setError('')
              setForm(structuredClone(t))
            }}
          >
            수정
          </Button>
        </Stack>
      ))}
      <Dialog
        open={!!form}
        onClose={() => !busy && setForm(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>템플릿 수정</DialogTitle>
        <DialogContent dividers>
          {form && (
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <Alert severity="info">
                변경 내용은 앞으로 적용하는 접수·점검표에만 반영됩니다. 기존
                기록은 유지됩니다.
              </Alert>
              <TextField
                label="템플릿 제목"
                value={form.definition.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    definition: { ...form.definition, title: e.target.value }
                  })
                }
              />
              <TextField
                label="분류 / 정비 유형"
                value={form.definition.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    definition: { ...form.definition, category: e.target.value }
                  })
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.active}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                  />
                }
                label="사용 활성화"
              />
              {form.kind === 'INCIDENT' ? (
                <>
                  <TextField
                    multiline
                    label="증상 작성 안내 (예시)"
                    value={form.definition.symptomHint}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        definition: {
                          ...form.definition,
                          symptomHint: e.target.value
                        }
                      })
                    }
                  />
                  <TextField
                    label="서비스 영향 안내"
                    value={form.definition.impactHint}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        definition: {
                          ...form.definition,
                          impactHint: e.target.value
                        }
                      })
                    }
                  />
                  {form.definition.questions.map((q, i) => (
                    <Box key={q.id}>
                      <TextField
                        fullWidth
                        label={`질문 ${i + 1}`}
                        value={q.label}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            definition: {
                              ...form.definition,
                              questions: form.definition.questions.map(
                                (x, j) =>
                                  j === i ? { ...x, label: e.target.value } : x
                              )
                            }
                          })
                        }
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={q.required}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                definition: {
                                  ...form.definition,
                                  questions: form.definition.questions.map(
                                    (x, j) =>
                                      j === i
                                        ? { ...x, required: e.target.checked }
                                        : x
                                  )
                                }
                              })
                            }
                          />
                        }
                        label="보완 권장"
                      />
                    </Box>
                  ))}
                </>
              ) : (
                form.definition.items.map((item, i) => (
                  <Box key={item.id}>
                    <TextField
                      fullWidth
                      label={`점검 항목 ${i + 1}`}
                      value={item.label}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          definition: {
                            ...form.definition,
                            items: form.definition.items.map((x, j) =>
                              j === i ? { ...x, label: e.target.value } : x
                            )
                          }
                        })
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={item.required}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              definition: {
                                ...form.definition,
                                items: form.definition.items.map((x, j) =>
                                  j === i
                                    ? { ...x, required: e.target.checked }
                                    : x
                                )
                              }
                            })
                          }
                        />
                      }
                      label="필수"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={item.allowNa}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              definition: {
                                ...form.definition,
                                items: form.definition.items.map((x, j) =>
                                  j === i
                                    ? { ...x, allowNa: e.target.checked }
                                    : x
                                )
                              }
                            })
                          }
                        />
                      }
                      label="사유 입력 시 해당 없음 허용"
                    />
                  </Box>
                ))
              )}
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
            onClick={async () => {
              if (!form) return
              setBusy(true)
              setError('')
              try {
                await invoke('templates:save', form)
                setForm(null)
                await load()
              } catch (e) {
                setError((e as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            템플릿 저장
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
