import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import log from 'electron-log/main'
import { openDb, closeDb } from './database/connection'
import { backup } from './services/AppService'
import { registerIpc } from './ipc/registerIpc'
import { koreaDate } from '../shared/date'

// 이름 변경(AFCCS → OMNIS): 새 데이터 폴더가 없으면 기존 DB·백업을 복사해 온다. 원본은 지우지 않는다.
// 임시 폴더에 모두 복사한 뒤에만 이름을 바꿔, 중간에 실패해도 반쪽짜리 OMNIS 폴더가 남지 않게 한다.
function migrateLegacyData(from: string, to: string): void {
  if (existsSync(to) || !existsSync(join(from, 'data'))) return
  const tmp = `${to}.migrating`
  try {
    rmSync(tmp, { recursive: true, force: true })
    for (const dir of ['data', 'backups']) if (existsSync(join(from, dir))) cpSync(join(from, dir), join(tmp, dir), { recursive: true })
    for (const suffix of ['', '-wal', '-shm']) { const old = join(tmp, 'data', `afccs.db${suffix}`); if (existsSync(old)) renameSync(old, join(tmp, 'data', `omnis.db${suffix}`)) }
    renameSync(tmp, to)
  } catch (error) {
    rmSync(tmp, { recursive: true, force: true })
    console.error('Legacy data migration failed', error)
  }
}
const appData = app.getPath('appData')
const userDataPath = process.env.OMNIS_E2E_DATA ?? join(appData, 'OMNIS')
if (!process.env.OMNIS_E2E_DATA) migrateLegacyData(join(appData, 'AFCCS'), userDataPath)
mkdirSync(userDataPath, { recursive: true })
app.setPath('userData', userDataPath)

let mainWindow: BrowserWindow | null = null
function createWindow(): BrowserWindow {
  const window = new BrowserWindow({ width: 1600, height: 950, minWidth: 1366, minHeight: 768, show: false, autoHideMenuBar: true, webPreferences: { preload: join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged } })
  mainWindow = window
  window.once('ready-to-show', () => window.show())
  window.once('closed', () => { if (mainWindow === window) mainWindow = null })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else window.loadFile(join(__dirname, '../renderer/index.html'))
  return window
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (!app.isReady()) return; const win = mainWindow ?? createWindow(); win.show(); win.focus() })
  app.whenReady().then(() => {
    log.initialize()
    try { openDb(); registerIpc() } catch (error) { log.error('Startup failed', error); throw error }
    createWindow()
    const lastBackup = koreaDate()
    const marker = join(app.getPath('userData'), `backup-${lastBackup}.marker`)
    import('node:fs').then(async fs => { if (!fs.existsSync(marker)) { try { await backup(); fs.writeFileSync(marker, '') } catch (error) { log.error('Backup failed', error) } } })
  })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  app.on('before-quit', closeDb)
  app.on('window-all-closed', () => { if (process.platform !== 'darwin' || process.env.OMNIS_E2E_DATA) app.quit() })
}
