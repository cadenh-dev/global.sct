import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { IpcEvents, WebRtcCommand } from '../shared/api'

contextBridge.exposeInMainWorld('sctWebRtc', {
  onCommand: (listener: (command: WebRtcCommand) => void) => {
    ipcRenderer.on('webrtc:command', (_event: IpcRendererEvent, command: IpcEvents['webrtc:command'][0]) => listener(command))
  },
  send: (event: IpcEvents['webrtc:event'][0]) => { ipcRenderer.send('webrtc:event', event) }
})
