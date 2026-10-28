import { useState } from 'react'
import {
  Alert,
  Autocomplete,
  Button,
  MenuItem,
  Stack,
  TextField
} from '@mui/material'
import {
  unitLevelLabels,
  type ActionDepartment,
  type OrganizationUnit
} from '../../shared/organization'

export default function ActionDepartmentPicker({
  teams,
  units,
  value,
  onChange,
  onUnitChange,
  disabled = false
}: {
  teams: ActionDepartment[]
  units: OrganizationUnit[]
  value: string
  onChange: (id: string) => void
  onUnitChange?: (id: string | null) => void
  disabled?: boolean
}) {
  const selected = teams.find((t) => t.id === value)
  const [filter, setFilter] = useState(''),
    [unitFilter, setUnitFilter] = useState<string | null>(null)
  const level = filter || selected?.unit_level || ''
  const selectedUnit =
    units.find((u) => u.id === (unitFilter ?? selected?.unit_id)) ?? null
  const visibleUnits = units.filter((u) => !level || level === u.unit_level)
  const options = teams.filter(
    (t) =>
      (t.available || t.id === value) &&
      (!level || (level === 'COMMON' ? !t.unit_id : t.unit_level === level)) &&
      (!selectedUnit || t.unit_id === selectedUnit.id)
  )
  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          select
          label="부대급"
          value={level}
          disabled={disabled}
          sx={{ width: { xs: '100%', sm: 145 }, flexShrink: 0 }}
          onChange={(e) => {
            setFilter(e.target.value)
            setUnitFilter(null)
            onChange('')
            onUnitChange?.(null)
          }}
        >
          <MenuItem value="">전체</MenuItem>
          <MenuItem value="COMMON">기존 공통 정비반</MenuItem>
          {Object.entries(unitLevelLabels).map(([key, label]) => (
            <MenuItem key={key} value={key}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <Autocomplete
          options={visibleUnits}
          value={selectedUnit}
          disabled={disabled || level === 'COMMON'}
          getOptionLabel={(u) => u.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          noOptionsText="등록된 부대가 없습니다"
          sx={{ flex: 1, minWidth: 0 }}
          onChange={(_, u) => {
            setUnitFilter(u?.id ?? null)
            onChange('')
            onUnitChange?.(u?.id ?? null)
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="소속 부대"
              placeholder="실제 부대명 검색"
            />
          )}
        />
      </Stack>
      <Autocomplete
        clearText="선택값 지우기"
        options={options}
        value={selected ?? null}
        disabled={disabled}
        getOptionLabel={(t) =>
          selectedUnit ? (t.department_name ?? t.name) : t.name
        }
        isOptionEqualToValue={(a, b) => a.id === b.id}
        noOptionsText="선택 가능한 정보통신부서가 없습니다"
        onChange={(_, t) => {
          onChange(t?.id ?? '')
          onUnitChange?.(t?.unit_id ?? selectedUnit?.id ?? null)
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="조치부서"
            placeholder="미지정"
            helperText="부서를 선택한 뒤 배정 버튼을 눌러야 저장됩니다."
          />
        )}
      />
      <Button
        size="small"
        disabled={disabled || !value}
        onClick={() => onChange('')}
        sx={{ alignSelf: 'flex-end' }}
      >
        조치부서 미지정
      </Button>
      {selectedUnit &&
        !teams.some(
          (t) => t.unit_id === selectedUnit.id && t.available === 1
        ) && (
          <Alert severity="info">
            이 부대의 확인된 정보통신부서가 아직 등록되지 않았습니다. 시스템관리
            → 조치부서에서 관리자가 실제 명칭을 등록할 수 있습니다.
          </Alert>
        )}
      {selected?.source_date && (
        <Alert severity="info">
          공개자료 명칭 기준: {selected.source_date} · 현행 명칭이 다르면
          관리자에게 수정 요청하십시오.
        </Alert>
      )}
    </Stack>
  )
}
