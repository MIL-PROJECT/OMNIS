import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { type Intake, type WorkTemplate } from '../../shared/usability'
import { invoke } from './usabilityApi'
import InputAssist from './InputAssist'

type Fields = {
  title: string
  category: string
  description: string
  serviceImpact?: string
  occurredAt?: string
  intake?: Intake
}
export default function IntakeTemplatePanel({
  value,
  onChange
}: {
  value: Fields
  onChange: (patch: Partial<Fields>) => void
}) {
  const [templates, setTemplates] = useState<WorkTemplate[]>([]),
    [choice, setChoice] = useState(''),
    [replace, setReplace] = useState<string[]>([]),
    [undo, setUndo] = useState<Fields | null>(null),
    [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    invoke<WorkTemplate[]>('templates:list', { kind: 'INCIDENT' })
      .then((v) => {
        if (alive) setTemplates(v)
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [])
  const selected = templates.find((t) => t.id === choice),
    current = templates.find((t) => t.id === value.intake?.templateId)
  const apply = () => {
    if (!selected) return
    setUndo(structuredClone(value))
    const patch: Partial<Fields> = {
      intake: {
        templateId: selected.id,
        templateVersion: selected.version,
        questions: selected.definition.questions,
        answers: (value.intake?.answers ?? []).filter((a) =>
          selected.definition.questions.some((q) => q.id === a.id)
        )
      }
    }
    if (!value.title.trim() || replace.includes('title'))
      patch.title = selected.definition.title
    if (!value.category.trim() || replace.includes('category'))
      patch.category = selected.definition.category
    onChange(patch)
    setReplace([])
  }
  return (
    <Stack
      spacing={1.5}
      sx={{ p: 1.5, border: '1px solid var(--line)', borderRadius: 2 }}
    >
      <TextField
        select
        label="자주 발생하는 고장"
        value={choice}
        onChange={(e) => {
          setChoice(e.target.value)
          setReplace([])
        }}
      >
        <MenuItem value="">자유 접수 / 템플릿 선택 해제</MenuItem>
        {templates.map((t) => (
          <MenuItem key={t.id} value={t.id}>
            {t.definition.title}
          </MenuItem>
        ))}
      </TextField>
      {error && <Alert severity="error">{error}</Alert>}
      {selected && (
        <Box>
          <Typography variant="subtitle2">
            미리보기 · {selected.definition.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selected.definition.symptomHint}
          </Typography>
          <Typography variant="caption">
            {selected.definition.impactHint} · 예시는 실제 증상으로 저장되지
            않습니다.
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap' }}>
            {(['title', 'category'] as const)
              .filter((k) => value[k].trim())
              .map((k) => (
                <FormControlLabel
                  key={k}
                  control={
                    <Checkbox
                      checked={replace.includes(k)}
                      onChange={(e) =>
                        setReplace((v) =>
                          e.target.checked
                            ? [...v, k]
                            : v.filter((x) => x !== k)
                        )
                      }
                    />
                  }
                  label={`${k === 'title' ? '제목' : '구분'} 교체`}
                />
              ))}
          </Stack>
          <Button onClick={apply} variant="outlined">
            {replace.length ? '선택 항목 교체' : '빈 항목 채우기'}
          </Button>
        </Box>
      )}
      <Stack direction="row" spacing={1}>
        {undo && (
          <Button
            onClick={() => {
              if (
                confirm(
                  '적용 직전 내용으로 되돌립니다. 이후 편집한 내용도 되돌릴까요?'
                )
              ) {
                onChange(undo)
                setUndo(null)
              }
            }}
          >
            되돌리기
          </Button>
        )}
        {value.intake?.templateId && (
          <Button
            onClick={() =>
              onChange({
                intake: {
                  ...value.intake!,
                  templateId: null,
                  templateVersion: null
                }
              })
            }
          >
            템플릿 연결 해제
          </Button>
        )}
      </Stack>
      <Typography variant="caption">
        적용 템플릿:{' '}
        {current?.definition.title ??
          (value.intake?.templateId ? '기존 템플릿' : '없음')}{' '}
        · 작성한 증상과 서비스 영향은 유지됩니다.
      </Typography>
      <InputAssist
        {...value}
        answers={value.intake?.answers ?? []}
        questions={value.intake?.questions ?? current?.definition.questions}
        onChange={(answers) =>
          onChange({
            intake: {
              templateId: value.intake?.templateId ?? null,
              templateVersion: value.intake?.templateVersion ?? null,
              answers
            }
          })
        }
      />
    </Stack>
  )
}
