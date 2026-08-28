// Deep diagnosis: intercept the exact failure point
const { app, BrowserWindow } = require('electron')
const url = process.argv[2] ?? 'http://127.0.0.1:3080/'

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280, height: 800, show: false,
    webPreferences: { sandbox: true },
  })
  const logs = []
  win.webContents.on('console-message', (e) => logs.push(`[${e.level}] ${e.message}`))

  await win.loadURL(url)
  await new Promise((r) => setTimeout(r, 5000))

  // Click pill to expand
  await win.webContents.executeJavaScript('document.querySelector(".dshwb-pill")?.click()').catch(() => {})
  await new Promise((r) => setTimeout(r, 8000))

  // Check the panel state and the connection service
  const diag = await win.webContents.executeJavaScript(`(() => {
    const root = document.querySelector('.dshwb-root')
    const card = document.querySelector('.dshwb-card')
    const errEl = document.querySelector('.dshwb-err')

    // Check what the error says
    const errText = errEl ? errEl.textContent : null
    const bodyText = card ? card.querySelector('.dshwb-body').textContent.slice(0, 300) : null

    // Probe the module loader for connection state
    let connState = 'unknown'
    try {
      const loader = window.__ModuleLoader__
      if (loader && loader.pendingQueue) {
        connState = 'pending: ' + loader.pendingQueue.length
      } else if (loader && loader.cache) {
        const keys = Object.keys(loader.cache)
        connState = 'cache keys: ' + keys.slice(0, 5).join(', ')
      }
    } catch (e) { connState = 'error: ' + e.message }

    return {
      panelExists: !!root,
      expanded: !!card,
      errorText: errText,
      bodyText,
      connectionState: connState,
    }
  })()`)

  console.log('DIAG ' + JSON.stringify(diag, null, 1))
  console.log('LOGS:\n' + logs.filter(l => l.includes('workbench') || l.includes('Error') || l.includes('error')).slice(-10).join('\n'))
  app.quit()
})
