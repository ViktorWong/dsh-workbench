// electron-builder afterPack hook: deep ad-hoc sign the ENTIRE .app bundle
// including the runtime tree in Resources. Without this, Gatekeeper
// evaluates runtime binaries individually on macOS.
const { execSync } = require('child_process')
const path = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productName}.app`,
  )
  const entitlements = path.join(__dirname, '..', 'build', 'entitlements.mac.plist')
  console.log(`  ⡡ deep-signing ${appPath} (ad-hoc + entitlements + runtime tree)`)
  try {
    execSync(
      `codesign --force --deep --sign - --options runtime --entitlements "${entitlements}" "${appPath}"`,
      { stdio: 'inherit', timeout: 300_000 },
    )
    console.log('  ⡡ deep-sign complete')
  } catch (err) {
    console.error('  ⡡ deep-sign failed (non-fatal):', err.message)
    // Don't fail the build — the per-file ad-hoc signatures from
    // electron-builder are still present; deep-sign is belt-and-braces.
  }
}
