import { useState } from 'react'
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
  Stack,
  TextField,
  Typography
} from '@mui/material'
import {
  analysisDescription,
  missingQuestions,
  supplementQuestions,
  type IntakeAnswer
} from '../../shared/usability'

type Props = {
  description: string
  serviceImpact?: string
  occurredAt?: string
  answers: IntakeAnswer[]
  onChange: (answers: IntakeAnswer[]) => void
  questions?: typeof supplementQuestions
  onAnalyze?: (answers: IntakeAnswer[]) => void
  analyzeLabel?: string
  busy?: boolean
}
export default function InputAssist(p: Props) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<IntakeAnswer[]>([]),
    [analyzeAfter, setAnalyzeAfter] = useState(false)
  const questions = p.questions ?? supplementQuestions
  const needs = missingQuestions(p, p.answers)
  const visibleQuestions = questions.filter(
    (q) =>
      needs.some((n) => n.id === q.id) ||
      p.answers.some((a) => a.id === q.id) ||
      !supplementQuestions.some((n) => n.id === q.id)
  )
  const start = (analyze: boolean) => {
    if (analyze && !needs.length) {
      p.onAnalyze?.(p.answers)
      return
    }
    setDraft(p.answers.map((v) => ({ ...v })))
    setAnalyzeAfter(analyze)
    setOpen(true)
  }
  const patch = (id: string, value: Partial<IntakeAnswer>) =>
    setDraft((rows) => {
      const old = rows.find((r) => r.id === id) ?? {
        id,
        text: '',
        unknown: false
      }
      return [...rows.filter((r) => r.id !== id), { ...old, ...value }]
    })
  const finish = (analyze: boolean) => {
    p.onChange(draft)
    setOpen(false)
    if (analyze) p.onAnalyze?.(draft)
  }
  return (
    <Box sx={{ border: '1px solid var(--line)', borderRadius: 2, p: 1.5 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
      >
        <Typography variant="body2" sx={{ flex: 1 }}>
          입력 점검 · 로컬 ·{' '}
          {needs.length
            ? `${needs.length}개 항목 보완 권장`
            : '입력 항목 확인됨'}
        </Typography>
        <Button disabled={p.busy} onClick={() => start(false)}>
          입력 내용 점검
        </Button>
        {p.onAnalyze && (
          <Button
            variant="contained"
            disabled={p.busy || !p.description.trim()}
            onClick={() => start(true)}
          >
            {p.analyzeLabel ?? 'AI 분석'}
          </Button>
        )}
      </Stack>
      {p.answers.some((a) => a.unknown || a.text) && (
        <Typography variant="caption">
          보완 답변 {p.answers.filter((a) => a.unknown || a.text).length}개 ·
          분석 시 함께 사용
        </Typography>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>입력 내용 보완</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">
              확인한 사실만 입력하십시오. 모르는 항목은 ‘확인하지 못함’을 선택할
              수 있습니다. 이 단계에서는 외부 AI를 호출하지 않습니다.
            </Alert>
            {!visibleQuestions.length && (
              <Typography>추가 보완 권장 항목이 없습니다.</Typography>
            )}
            {visibleQuestions.map((q) => {
              const a = draft.find((a) => a.id === q.id)
              return (
                <Box key={q.id}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={1}
                    label={`${q.label}${q.required ? ' (보완 권장)' : ''}`}
                    value={a?.text ?? ''}
                    disabled={a?.unknown}
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                    onChange={(e) => patch(q.id, { text: e.target.value })}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={a?.unknown ?? false}
                        onChange={(e) =>
                          patch(q.id, { unknown: e.target.checked })
                        }
                      />
                    }
                    label="확인하지 못함"
                  />
                </Box>
              )
            })}
            <Typography variant="subtitle2">반영 미리보기</Typography>
            <Typography
              sx={{
                whiteSpace: 'pre-wrap',
                fontSize: 13,
                bgcolor: 'var(--bg)',
                p: 1.5,
                borderRadius: 2
              }}
            >
              {analysisDescription(p.description, draft, questions)}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setOpen(false)}>취소</Button>
          {analyzeAfter && (
            <Button
              onClick={() => {
                setOpen(false)
                p.onAnalyze?.(p.answers)
              }}
            >
              현재 내용으로 분석
            </Button>
          )}
          <Button variant="contained" onClick={() => finish(analyzeAfter)}>
            {analyzeAfter ? '보완 후 분석' : '보완 내용 반영'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
