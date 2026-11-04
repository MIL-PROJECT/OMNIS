import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import log from 'electron-log/main'
import { openDb, closeDb } from './database/connection'
import { backup } from './services/AppService'
import { registerIpc } from './ipc/registerIpc'
import { koreaDate } from '../shared/date'
import { fitWindowBounds, initialWindowBounds, minimumWindowSize } from './windowBounds'

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
  // Electron workArea uses logical pixels, including the Windows display scale and taskbar.
  const workArea = screen.getPrimaryDisplay().workArea
  const [minWidth, minHeight] = minimumWindowSize(workArea)
  const window = new BrowserWindow({ ...initialWindowBounds(workArea), minWidth, minHeight, show: false, autoHideMenuBar: true, webPreferences: { preload: join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged } })
  mainWindow = window
  let fitTimer: ReturnType<typeof setTimeout> | undefined
  const fitDisplay = () => {
    clearTimeout(fitTimer)
    fitTimer = setTimeout(() => {
      if (window.isDestroyed()) return
      const bounds = window.getBounds()
      const area = screen.getDisplayMatching(bounds).workArea
      const minimum = minimumWindowSize(area)
      const currentMinimum = window.getMinimumSize()
      if (minimum.some((value, index) => value !== currentMinimum[index])) window.setMinimumSize(...minimum)
      if (!window.isMaximized() && !window.isFullScreen() && (bounds.width > area.width || bounds.height > area.height)) window.setBounds(fitWindowBounds(bounds, area))
    }, 150)
  }
  window.on('move', fitDisplay)
  screen.on('display-metrics-changed', fitDisplay)
  screen.on('display-removed', fitDisplay)
  window.once('ready-to-show', () => window.show())
  window.once('closed', () => {
    clearTimeout(fitTimer)
    screen.removeListener('display-metrics-changed', fitDisplay)
    screen.removeListener('display-removed', fitDisplay)
    if (mainWindow === window) mainWindow = null
  })
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
