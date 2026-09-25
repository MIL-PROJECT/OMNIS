import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import log from 'electron-log/main'
import { openDb, closeDb } from './database/connection'
import { backup } from './services/AppService'
import { registerIpc } from './ipc/registerIpc'

const userDataPath = process.env.AFCCS_E2E_DATA ?? join(app.getPath('appData'), 'AFCCS')
mkdirSync(userDataPath, { recursive: true })
app.setPath('userData', userDataPath)

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { const win = BrowserWindow.getAllWindows()[0]; win?.show(); win?.focus() })
  app.whenReady().then(() => {
    log.initialize()
    try { openDb(); registerIpc() } catch (error) { log.error('Startup failed', error); throw error }
    const window = new BrowserWindow({ width: 1600, height: 950, minWidth: 1366, minHeight: 768, show: false, autoHideMenuBar: true, webPreferences: { preload: join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged } })
    window.once('ready-to-show', () => window.show())
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', event => event.preventDefault())
    if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
    else window.loadFile(join(__dirname, '../renderer/index.html'))
    const lastBackup = new Date().toISOString().slice(0, 10)
    const marker = join(app.getPath('userData'), `backup-${lastBackup}.marker`)
    import('node:fs').then(async fs => { if (!fs.existsSync(marker)) { try { await backup(); fs.writeFileSync(marker, '') } catch (error) { log.error('Backup failed', error) } } })
  })
  app.on('before-quit', closeDb)
  app.on('window-all-closed', () => app.quit())
}
