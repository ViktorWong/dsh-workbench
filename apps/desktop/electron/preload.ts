import { contextBridge, ipcRenderer } from 'electron'

/**
 * Whitelisted desktop API exposed to the renderer (ADR-001 §2).
 * Every addition here must have input validation on the main-process side.
 */
contextBridge.exposeInMainWorld('workbench', {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  },
})
