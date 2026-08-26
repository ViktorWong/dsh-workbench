declare global {
  interface Window {
    workbench?: {
      app: { getVersion: () => Promise<string> }
    }
  }
}

const root = document.getElementById('root')
if (root) {
  void window.workbench?.app.getVersion().then((v) => {
    root.textContent = `dsh-workbench v${v}`
  })
}

export {}
