// Panel probe: loads the dsh web UI and asserts the floating panel mounts.
// Usage: pnpm exec electron scripts/probe-panel.cjs [url]
const { app, BrowserWindow } = require('electron')

const url = process.argv[2] ?? 'http://127.0.0.1:3080/'

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  const logs = []
  win.webContents.on('console-message', (e) => logs.push(`[${e.level}] ${e.message}`))
  await win.loadURL(url)
  await new Promise((r) => setTimeout(r, 9000))
  const result = await win.webContents.executeJavaScript(`(() => {
    const root = document.querySelector('.dshwb-root')
    return {
      mounted: !!root,
      pill: !!document.querySelector('.dshwb-pill'),
      card: !!document.querySelector('.dshwb-card'),
      cells: document.querySelectorAll('.dshwb-cell').length,
      bars: document.querySelectorAll('.dshwb-bar').length,
      text: root ? root.textContent.slice(0, 120) : '',
    }
  })()`)
  console.log('PANEL_PROBE', JSON.stringify(result, null, 1))
  // Expand and inspect the full card with real data.
  if (result.pill) {
    await win.webContents.executeJavaScript(`document.querySelector('.dshwb-pill').click()`)
    await new Promise((r) => setTimeout(r, 2500))
    const expanded = await win.webContents.executeJavaScript(`(() => ({
      card: !!document.querySelector('.dshwb-card'),
      cells: [...document.querySelectorAll('.dshwb-cell')].map(c => c.textContent.trim()),
      bars: document.querySelectorAll('.dshwb-bar').length,
      rows: document.querySelectorAll('.dshwb-rows tr').length,
      foot: (document.querySelector('.dshwb-foot') || {}).textContent || '',
    }))()`)
    console.log('PANEL_EXPANDED', JSON.stringify(expanded, null, 1))
  }
  console.log('CONSOLE:', logs.slice(-8).join('\n'))
  app.quit()
})
