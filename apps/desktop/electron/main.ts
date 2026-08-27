import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { DshSupervisor } from './supervisor'
import { provisionProfile, resolveDshBin } from './provisioning'

const PROFILE = 'dsh-workbench'
const PREFERRED_PORT = 3080

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let supervisor: DshSupervisor | null = null

function createTray(): void {
  // Placeholder empty image until a real tray icon asset is bundled.
  tray = new Tray(nativeImage.createEmpty())
  tray.setToolTip('dsh-workbench')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示窗口', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]),
  )
}

function createWindow(url: string): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'dsh-workbench',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    maybeSmoke()
  })
  // Surface web-client errors (plugin bundles included) in the shell log.
  mainWindow.webContents.on('console-message', (_e, _level, message, _line, sourceId) => {
    if (_level >= 2) console.warn(`[web] ${sourceId}: ${message}`)
  })
  void mainWindow.loadURL(url)
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/** CI smoke hook: WORKBENCH_SMOKE=1 quits the app shortly after first paint. */
function maybeSmoke(): void {
  if (process.env.WORKBENCH_SMOKE !== '1') return
  console.log('SMOKE_OK')
  const delay = Number(process.env.WORKBENCH_SMOKE_DELAY_MS ?? 2_000)
  setTimeout(() => {
    // Capture right before quitting so long-delay runs catch the loaded UI.
    if (mainWindow) {
      void mainWindow.webContents
        .capturePage()
        .then((img) => {
          writeFileSync(process.env.WORKBENCH_SMOKE_SHOT ?? '/tmp/workbench-smoke.png', img.toPNG())
        })
        .catch(() => {})
        .finally(() => app.quit())
      return
    }
    app.quit()
  }, delay)
}

async function bootstrap(): Promise<void> {
  // ADR-002: install companion plugins into the dedicated profile.
  // Non-fatal: on failure we boot with dsh-base only and surface a warning.
  await provisionProfile(PROFILE).catch((err) => {
    console.warn('[workbench] profile provisioning failed:', err)
  })

  supervisor = new DshSupervisor({
    dshBin: resolveDshBin(),
    profile: PROFILE,
    preferredPort: PREFERRED_PORT,
    spawnOptions: { execPath: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } },
  })
  supervisor.on('crashed', ({ code, restarts }) => {
    console.error(`[workbench] dsh service crashed (code=${code}, restarts=${restarts})`)
    mainWindow?.webContents.executeJavaScript(
      `console.warn('dsh service crashed after ${restarts} restarts')`,
    ).catch(() => {})
  })

  const { url } = await supervisor.start()
  createWindow(url)
  createTray()
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => mainWindow?.show())
  app
    .whenReady()
    .then(() => bootstrap())
    .catch((err: unknown) => {
      console.error('[workbench] bootstrap failed:', err)
      supervisor?.stop()
      dialog.showErrorBox(
        'dsh-workbench 启动失败',
        `无法启动 DeepSeek Harness 服务：\n\n${String(err)}\n\n详情请查看终端输出。`,
      )
      app.quit()
    })
}

app.on('window-all-closed', () => {
  // Keep running in the tray; the dsh service stays alive for tray relaunch.
  if (process.platform === 'darwin') return
  if (tray) return // explicit quit via tray
  app.quit()
})

app.on('before-quit', () => {
  supervisor?.stop()
})

// Minimal IPC surface; every channel must validate input and stay whitelisted
// (see .claude/skills/_common/code-review-checklist.md §3).
ipcMain.handle('app:getVersion', () => app.getVersion())
