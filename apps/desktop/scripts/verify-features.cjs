// Feature verification: loads the DSH web UI and checks all new features.
const { app, BrowserWindow } = require('electron')
const url = process.argv[2] ?? 'http://127.0.0.1:3080/'

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      webPreferences: { sandbox: true },
    })
    await win.loadURL(url)
    await new Promise((r) => setTimeout(r, 6000))
    // Expand panel
    await win.webContents.executeJavaScript(
      'document.querySelector(".dshwb-pill")?.click()',
    )
    await new Promise((r) => setTimeout(r, 2500))
    const check = await win.webContents.executeJavaScript(`(() => ({
      search: !!document.querySelector(".dshwb-search"),
      placeholder: (document.querySelector(".dshwb-search") || {}).placeholder || "none",
      cards: document.querySelectorAll(".dshwb-scard").length,
      tabs: document.querySelectorAll(".dshwb-tab").length,
      drag: !!document.querySelector(".dshwb-drag"),
      modelPicker: !!document.querySelector(".dshwb-samodel"),
    }))()`)
    console.log('FEATURES ' + JSON.stringify(check))
    app.quit()
  } catch (err) {
    console.error('VERIFY_FAILED', err.message)
    app.quit()
  }
})
