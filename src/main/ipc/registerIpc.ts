import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { schemas, type Channel, type Result } from '../../shared/contracts'
import { run } from '../services/AppService'

export function registerIpc(): void {
  for (const channel of Object.keys(schemas) as Channel[]) {
    ipcMain.handle(channel, async (event, payload: unknown): Promise<Result<unknown>> => {
      try {
        if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) throw new Error('허용되지 않은 프레임입니다.')
        const parsed = schemas[channel].parse(payload ?? {}) as Record<string, unknown>
        return { ok: true, data: await run(channel, parsed) }
      } catch (error) {
        log.error(`IPC ${channel}`, error instanceof Error ? error.message : 'Unknown error')
        return { ok: false, error: { code: 'REQUEST_FAILED', message: error instanceof Error ? error.message : '요청에 실패했습니다.' } }
      }
    })
  }
}
