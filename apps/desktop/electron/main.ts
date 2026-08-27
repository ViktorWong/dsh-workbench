import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { DshSupervisor } from './supervisor'
import { provisionProfile } from './provisioning'
import { resolveDshBin } from './runtime-manager'
import {
  fetchLatestDshVersion,
  rollbackRuntime,
  runtimeVersion,
  shouldAutoUpdate,
  updateRuntime,
  userRuntimeDir,
  writeRuntimeStatus,
} from './runtime-manager'

const PROFILE = 'dsh-workbench'
const PREFERRED_PORT = 3080
const UPDATE_CHECK_INITIAL_MS = 10_000
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let supervisor: DshSupervisor | null = null

function createTray(): void {
  // Tray uses the bundled app icon (small); macOS renders it as-is.
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
  const image = nativeImage.createFromPath(iconPath)
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 }))
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
  mainWindow.webContents.on('console-message', (event) => {
    if (Number(event.level) >= 2) {
      console.warn(`[web] ${event.sourceId}: ${event.message}`)
    }
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
    // Channel sanity: force a page-level console message, then capture.
    if (mainWindow) {
      void mainWindow.webContents
        .executeJavaScript("console.warn('SMOKE_CHANNEL_CHECK')")
        .catch(() => {})
        .then(() =>
          mainWindow?.webContents.capturePage().then((img) => {
            writeFileSync(process.env.WORKBENCH_SMOKE_SHOT ?? '/tmp/workbench-smoke.png', img.toPNG())
          }),
        )
        .catch(() => {})
        .finally(() => app.quit())
      return
    }
    app.quit()
  }, delay)
}

/**
 * ADR-004: poll npm dist-tags for a newer dsh; same-major releases upgrade
 * the userData runtime in the background (applies on next launch). Offline
 * checks fail silently.
 */
function scheduleUpdateChecks(): void {
  const check = async (): Promise<void> => {
    const current = runtimeVersion(userRuntimeDir())
    if (!current) return
    writeRuntimeStatus({ state: 'checking', current })
    const latest = await fetchLatestDshVersion()
    if (!latest) {
      writeRuntimeStatus({ state: 'idle', current })
      return
    }
    if (!shouldAutoUpdate(current, latest)) {
      const note = current === latest ? 'up to date' : `new major ${latest} requires manual upgrade`
      writeRuntimeStatus({ state: current === latest ? 'idle' : 'skipped-major', current, latest, note })
      return
    }
    console.log(`[workbench] dsh ${latest} available (have ${current}); updating runtime…`)
    const result = updateRuntime(latest)
    writeRuntimeStatus({
      state: result.ok ? 'updated' : 'error',
      current: runtimeVersion(userRuntimeDir()),
      latest,
      note: result.note,
    })
    console.log(`[workbench] runtime update: ${result.ok ? 'ok' : 'failed'} — ${result.note}`)
  }
  setTimeout(() => void check().catch(() => writeRuntimeStatus({ state: 'error' })), UPDATE_CHECK_INITIAL_MS)
  setInterval(() => void check().catch(() => writeRuntimeStatus({ state: 'error' })), UPDATE_CHECK_INTERVAL_MS)
}

/**
 * Watch for the subagent-model restart signal (written by the host plugin
 * when the user changes the model); restart dsh gracefully.
 */
function watchRestartSignal(): void {
  const signalFile = path.join(
    process.env.DSH_HOME ?? path.join(homedir(), '.dsh'),
    'workbench', 'restart-signal',
  )
  let lastSignal = 0
  setInterval(() => {
    try {
      const stat = statSync(signalFile)
      if (stat.mtimeMs > lastSignal && lastSignal > 0) {
        console.log('[workbench] restart signal detected — restarting dsh…')
        // Graceful stop then fresh start in the next tick
        supervisor?.stop()
        setTimeout(() => {
          supervisor = new DshSupervisor({
            dshBin: resolveDshBin(),
            profile: PROFILE,
            preferredPort: PREFERRED_PORT,
            spawnOptions: { execPath: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } },
          })
          void supervisor.start().then(({ url }) => {
            void mainWindow?.loadURL(url)
            console.log('[workbench] dsh restarted at', url)
          })
        }, 2_000)
      }
      lastSignal = stat.mtimeMs
    } catch {
      // File doesn't exist yet — normal
    }
  }, 3_000)
}

async function bootstrap(): Promise<void> {
  // ADR-004: run from the SIGNED bundled runtime by default (single
  // Gatekeeper approval); userData copy appears only after an auto-update.
  if (app.isPackaged) {
    const fromUser = resolveDshBin().includes('userData')
    const runtimeDir = fromUser ? userRuntimeDir() : path.join(process.resourcesPath, 'runtime')
    console.log(`[workbench] runtime ${runtimeVersion(runtimeDir)} (${fromUser ? 'userData' : 'bundled'})`)
    scheduleUpdateChecks()
    watchRestartSignal()
  }

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

  let url: string
  try {
    ;({ url } = await supervisor.start())
  } catch (err) {
    // ADR-004 §2.4: a runtime that cannot boot (e.g. a broken auto-updated
    // rc) falls back to runtime-backup exactly once, then retries.
    if (app.isPackaged && rollbackRuntime()) {
      console.error(`[workbench] boot failed (${String(err).slice(0, 200)}); rolled back to backup runtime`)
      writeRuntimeStatus({ state: 'error', note: 'runtime failed to boot; rolled back to backup' })
      supervisor = new DshSupervisor({
        dshBin: resolveDshBin(),
        profile: PROFILE,
        preferredPort: PREFERRED_PORT,
        spawnOptions: { execPath: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } },
      })
      ;({ url } = await supervisor.start())
    } else {
      throw err
    }
  }
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
