import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Stack } from '@mui/material'
import MenuBookRounded from '@mui/icons-material/MenuBookRounded'
import DownloadRounded from '@mui/icons-material/DownloadRounded'
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import { manualRevision, type ManualInfo } from '../../shared/manuals'
import { Card, PageHeader } from './ui'

async function call<T>(
  channel: Channel,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const r = (await window.omnis.invoke(channel, payload)) as Result<T>
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

export default function ManualsManagement({ user }: { user: PublicUser }) {
  const [manuals, setManuals] = useState<ManualInfo[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState('')
  const load = () => {
    setLoading(true)
    setError('')
    call<ManualInfo[]>('manuals:list')
      .then(setManuals)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])
  const act = async (role: string, action: 'open' | 'save') => {
    if (busy) return
    setBusy(`${role}-${action}`)
    setError('')
    setNotice('')
    try {
      const result = await call<{ canceled?: boolean }>(
        action === 'open' ? 'manuals:open' : 'manuals:save',
        { role }
      )
      if (action === 'save' && !result?.canceled)
        setNotice('선택한 위치에 매뉴얼 PDF를 저장했습니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '매뉴얼 처리에 실패했습니다.')
    } finally {
      setBusy('')
    }
  }
  return (
    <>
      <PageHeader
        section="도움말"
        title="사용자 매뉴얼"
        description="역할별 업무 절차를 확인하고 PDF를 원하는 위치에 저장합니다."
      />
      <Stack spacing={2}>
        <Alert severity="info">
          문서 기준: {manualRevision}. 이후 변경된 일부 화면과 차이가 있을 수
          있습니다. 인터넷 연결 없이 사용할 수 있습니다.
        </Alert>
        {error && (
          <Alert
            severity="error"
            action={
              <Button onClick={load} disabled={loading || !!busy}>
                다시 조회
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {notice && <Alert severity="success">{notice}</Alert>}
        <Card
          icon={MenuBookRounded}
          title="역할별 사용자 매뉴얼"
          subtitle="본인 역할의 매뉴얼을 먼저 표시합니다. 다른 역할의 문서도 확인할 수 있습니다."
        >
          {loading ? (
            <Box sx={{ p: 3, color: 'text.secondary' }}>매뉴얼 조회 중</Box>
          ) : (
            <Box component="ul" className="manual-list">
              {[...manuals]
                .sort(
                  (a, b) =>
                    Number(b.role === user.role) - Number(a.role === user.role)
                )
                .map((m) => (
                  <Box
                    component="li"
                    key={m.role}
                    className={`manual-row${m.role === user.role ? ' is-current' : ''}`}
                  >
                    <Box className="manual-icon">
                      <MenuBookRounded />
                    </Box>
                    <Box className="manual-copy">
                      <Box className="manual-title">
                        <strong>{m.title} 매뉴얼</strong>
                        {m.role === user.role && (
                          <Chip
                            label="내 역할"
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                      </Box>
                      <p>{m.description}</p>
                      <small>
                        {m.role} · PDF ·{' '}
                        {m.available
                          ? `${(m.bytes / 1024 / 1024).toFixed(1)} MB`
                          : '파일을 사용할 수 없습니다'}
                      </small>
                    </Box>
                    <Box className="manual-actions">
                      <Button
                        variant="outlined"
                        startIcon={<OpenInNewRounded />}
                        aria-label={`${m.title} PDF 열기`}
                        disabled={!!busy || !m.available}
                        onClick={() => act(m.role, 'open')}
                      >
                        {busy === `${m.role}-open` ? '여는 중' : 'PDF 열기'}
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<DownloadRounded />}
                        aria-label={`${m.title} 매뉴얼 다운로드`}
                        disabled={!!busy || !m.available}
                        onClick={() => act(m.role, 'save')}
                      >
                        {busy === `${m.role}-save` ? '저장 중' : '다운로드'}
                      </Button>
                    </Box>
                  </Box>
                ))}
            </Box>
          )}
        </Card>
      </Stack>
    </>
  )
}
