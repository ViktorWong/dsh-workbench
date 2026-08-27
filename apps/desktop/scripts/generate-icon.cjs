// Renders scripts/generate-icon.html on an offscreen window and captures the
// canvas as build/icon.png (1024x1024). electron-builder picks build/icon.png
// up automatically and derives icns/ico for every platform.
// Usage: pnpm exec electron scripts/generate-icon.cjs
const { app, BrowserWindow } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const path = require('node:path')

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 1024,
      height: 1024,
      show: false,
      webPreferences: { offscreen: true },
    })
    await win.loadFile(path.join(__dirname, 'generate-icon.html'))
    // Give the offscreen renderer a moment to rasterize, then capture.
    await new Promise((resolve) => setTimeout(resolve, 800))
    const shot = await win.webContents.capturePage()
    mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true })
    writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), shot.toPNG())
    console.log('icon written to apps/desktop/build/icon.png')
    process.exit(0)
  } catch (err) {
    console.error('icon generation failed:', err)
    process.exit(1)
  }
})
