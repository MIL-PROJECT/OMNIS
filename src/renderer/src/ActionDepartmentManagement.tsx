import { useEffect, useState } from 'react'
import {
  Alert,
  Autocomplete,
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
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import AccountTreeRounded from '@mui/icons-material/AccountTreeRounded'
import {
  unitLevelLabels,
  type ActionDepartment,
  type OrganizationUnit,
  type UnitLevel
} from '../../shared/organization'
import { invoke as api } from './usabilityApi'
import { Card } from './ui'

type Form = {
  id?: string
  unitId?: string
  unitName: string
  unitLevel: UnitLevel
  departmentName: string
  sourceUrl: string
  sourceDate: string
  note: string
  available: boolean
}
const empty: Form = {
  unitName: '',
  unitLevel: 'WING',
  departmentName: '',
  sourceUrl: '',
  sourceDate: '',
  note: '',
  available: true
}
export default function ActionDepartmentManagement() {
  const [units, setUnits] = useState<OrganizationUnit[]>([]),
    [teams, setTeams] = useState<ActionDepartment[]>([]),
    [form, setForm] = useState<Form | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const load = async () => {
    const data = await api<{
      units: OrganizationUnit[]
      departments: ActionDepartment[]
    }>('organizations:list', {})
    setUnits(data.units)
    setTeams(data.departments)
  }
  useEffect(() => {
    let active = true
    api<{ units: OrganizationUnit[]; departments: ActionDepartment[] }>(
      'organizations:list',
      {}
    )
      .then((data) => {
        if (active) {
          setUnits(data.units)
          setTeams(data.departments)
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [])
  const save = async () => {
    if (!form || busy) return
    setBusy(true)
    setError('')
    try {
      await api('organizations:saveDepartment', {
        ...form,
        sourceUrl: form.sourceUrl || undefined,
        sourceDate: form.sourceDate || undefined
      })
      await load()
      setForm(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const edit = (row: ActionDepartment) => {
    setError('')
    setForm({
      id: row.id,
      unitId: row.unit_id!,
      unitName: row.unit_name!,
      unitLevel: row.unit_level!,
      departmentName: row.department_name!,
      sourceUrl: row.source_url ?? '',
      sourceDate: row.source_date ?? '',
      note: row.note ?? '',
      available: !!row.available
    })
  }
  const columns: GridColDef[] = [
    {
      field: 'unit_level',
      headerName: '부대급',
      width: 110,
      valueFormatter: (v) => unitLevelLabels[v as UnitLevel] ?? '공통'
    },
    {
      field: 'unit_name',
      headerName: '실제 부대명',
      width: 220,
      valueFormatter: (v) => v || '기존 공통 정비반'
    },
    {
      field: 'department_name',
      headerName: '조치부서',
      width: 240,
      renderCell: ({ row }) => row.department_name ?? row.name
    },
    {
      field: 'provenance',
      headerName: '등록 기준',
      width: 120,
      valueFormatter: (v) =>
        v === 'DEMO'
          ? '시연용 담당창구'
          : v === 'PUBLIC'
            ? '공개자료'
            : v === 'LOCAL'
              ? '관리자 등록'
              : '기존 공통'
    },
    {
      field: 'available',
      headerName: '상태',
      width: 90,
      valueFormatter: (v) => (v ? '사용' : '사용 안 함')
    },
    {
      field: 'edit',
      headerName: '',
      width: 85,
      sortable: false,
      renderCell: ({ row }) =>
        row.unit_id ? <Button onClick={() => edit(row)}>수정</Button> : null
    }
  ]
  const missing = units.filter((u) => !teams.some((t) => t.unit_id === u.id))
  return (
    <Card
      title="조치부서 관리"
      subtitle="실제 부대와 정보통신부서를 연결합니다"
      icon={AccountTreeRounded}
      action={
        <Button
          variant="contained"
          onClick={() => {
            setError('')
            setForm({ ...empty })
          }}
        >
          조치부서 추가
        </Button>
      }
    >
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          공개자료에서 확인한 명칭과 관리자 등록을 구분합니다. 부대만 등록된
          경우 내부 편제를 추정해 배정하지 않습니다. 기존 업무는 부서를 사용 안
          함으로 바꿔도 보존됩니다.
        </Alert>
        {error && !form && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
        {missing.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            부서 확인·등록 필요: {missing.map((u) => u.name).join(', ')}
          </Typography>
        )}
      </Box>
      <DataGrid
        rows={teams}
        columns={columns}
        autoHeight
        disableRowSelectionOnClick
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: { paginationModel: { page: 0, pageSize: 10 } }
        }}
      />
      <Dialog
        open={!!form}
        onClose={() => {
          if (!busy) setForm(null)
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {form?.id ? '조치부서 수정' : '조치부서 추가'}
        </DialogTitle>
        <DialogContent>
          {form && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                select
                label="부대급"
                value={form.unitLevel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    unitId: undefined,
                    unitName: '',
                    unitLevel: e.target.value as UnitLevel
                  })
                }
              >
                {Object.entries(unitLevelLabels).map(([v, label]) => (
                  <MenuItem key={v} value={v}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <Autocomplete
                freeSolo
                options={units
                  .filter((u) => u.unit_level === form.unitLevel)
                  .map((u) => u.name)}
                inputValue={form.unitName}
                onInputChange={(_, name) => {
                  const unit = units.find((u) => u.name === name)
                  setForm({ ...form, unitName: name, unitId: unit?.id })
                }}
                renderInput={(params) => (
                  <TextField {...params} required label="실제 부대명" />
                )}
              />
              <TextField
                required
                label="정보통신부서 명칭"
                value={form.departmentName}
                onChange={(e) =>
                  setForm({ ...form, departmentName: e.target.value })
                }
              />
              <TextField
                label="확인 자료 주소 (선택)"
                value={form.sourceUrl}
                onChange={(e) =>
                  setForm({ ...form, sourceUrl: e.target.value })
                }
                helperText="자료 주소는 저장만 하며 앱에서 자동 접속하지 않습니다."
              />
              <TextField
                type="date"
                label="자료 기준일 (선택)"
                slotProps={{ inputLabel: { shrink: true } }}
                value={form.sourceDate}
                onChange={(e) =>
                  setForm({ ...form, sourceDate: e.target.value })
                }
              />
              <TextField
                label="확인 메모"
                multiline
                minRows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.available}
                    onChange={(e) =>
                      setForm({ ...form, available: e.target.checked })
                    }
                  />
                }
                label="새 배정에 사용"
              />
              <Typography variant="caption">
                관리자 수정·추가 항목은 ‘관리자 등록’으로 저장됩니다. 기존
                업무의 요청부서·담당자·배정 기록을 자동으로 바꾸지 않습니다.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setForm(null)}>
            취소
          </Button>
          <Button
            variant="contained"
            disabled={
              busy || !form?.unitName.trim() || !form?.departmentName.trim()
            }
            onClick={save}
          >
            {busy ? '저장 중' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
