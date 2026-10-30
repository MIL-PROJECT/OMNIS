import { useEffect, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import GroupsRounded from '@mui/icons-material/GroupsRounded'
import { Card } from './ui'
import { invoke } from './usabilityApi'
import {
  unitLevelLabels,
  type OrganizationUnit
} from '../../shared/organization'

type Member = {
  id: string
  display_name: string
  rank_name: string
  unit_name: string
  active: number
  is_demo: number
}
export default function OrganizationMembers() {
  const [units, setUnits] = useState<OrganizationUnit[]>([]),
    [level, setLevel] = useState('WING'),
    [unitId, setUnitId] = useState(''),
    [members, setMembers] = useState<Member[]>([]),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    invoke<{ units: OrganizationUnit[] }>('organizations:list')
      .then((data) => {
        if (active) {
          setUnits(data.units)
          setUnitId(data.units.find((u) => u.unit_level === 'WING')?.id ?? '')
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true
    setMembers([])
    setError('')
    if (unitId)
      invoke<Member[]>('organizations:members', { unitId })
        .then((rows) => {
          if (active) setMembers(rows)
        })
        .catch((e) => {
          if (active) setError(e.message)
        })
    return () => {
      active = false
    }
  }, [unitId])
  return (
    <Box sx={{ mt: 2 }}>
      <Card
        title="부대 담당자"
        subtitle="부대별 가상 담당자 10명 · 시연용 인물"
        icon={GroupsRounded}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              select
              label="담당자 부대급"
              value={level}
              sx={{ minWidth: 150 }}
              onChange={(e) => {
                setLevel(e.target.value)
                setUnitId(
                  units.find((u) => u.unit_level === e.target.value)?.id ?? ''
                )
              }}
            >
              {(['WING', 'BRIGADE', 'GROUP'] as const).map((key) => (
                <MenuItem key={key} value={key}>
                  {unitLevelLabels[key]}
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              sx={{ flex: 1 }}
              options={units.filter((u) => u.unit_level === level)}
              value={units.find((u) => u.id === unitId) ?? null}
              getOptionLabel={(u) => u.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, unit) => setUnitId(unit?.id ?? '')}
              renderInput={(params) => (
                <TextField {...params} label="담당자 소속 부대" />
              )}
            />
          </Stack>
          <Alert severity="info">
            이름·계급은 임의로 만든 가상 인물입니다. 업무 배정에 사용할 수
            있으며 로그인 계정이나 실제 부대원 명부가 아닙니다.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2">
            등록 {members.length}명 · 사용 가능{' '}
            {members.filter((m) => m.active).length}명
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
              gap: 1
            }}
          >
            {members.map((member) => (
              <Box
                key={member.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 1.5
                }}
              >
                <Typography variant="body2" sx={{fontWeight:600}}>
                  {member.rank_name} {member.display_name}{' '}
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                  >
                    · 가상{member.active ? '' : ' · 사용 안 함'}
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {member.unit_name}
                </Typography>
              </Box>
            ))}
          </Box>
          {!unitId && (
            <Typography color="text.secondary">부대를 선택하십시오.</Typography>
          )}
        </Stack>
      </Card>
    </Box>
  )
}
