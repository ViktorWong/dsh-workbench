// Debug the connection API availability inside the web client context
const { app, BrowserWindow } = require('electron')
const url = process.argv[2] ?? 'http://127.0.0.1:3080/'

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: { sandbox: true },
  })
  const logs = []
  win.webContents.on('console-message', (e) => logs.push(`[${e.level}] ${e.message}`))

  await win.loadURL(url)
  await new Promise((r) => setTimeout(r, 8000))

  // Inject a probe directly into the page context
  const result = await win.webContents.executeJavaScript(`(() => {
    // Try to find the connection through the global module loader
    const loader = window.__ModuleLoader__
    const results = { loaderExists: !!loader, loaderKeys: loader ? Object.keys(loader) : [] }

    // Try to get a reference to any registered module that has connection
    if (loader && loader.cache) {
      results.cacheKeys = Object.keys(loader.cache).slice(0, 10)
      for (const [id, mod] of Object.entries(loader.cache)) {
        if (mod && mod.api && mod.api.sessions) {
          results.foundIn = id
          results.hasSessions = true
          results.sessionListType = typeof mod.api.sessions.list
          break
        }
      }
    }

    // Check the panel state
    const panel = document.querySelector('.dshwb-root')
    results.panelExists = !!panel
    results.panelText = panel ? panel.textContent.slice(0, 200) : ''
    results.hasSearch = !!document.querySelector('.dshwb-search')
    results.hasCards = document.querySelectorAll('.dshwb-scard').length

    return results
  })()`)

  console.log('DEBUG ' + JSON.stringify(result, null, 1))
  console.log('CONSOLE_LOGS:\n' + logs.slice(-15).join('\n'))
  app.quit()
})
