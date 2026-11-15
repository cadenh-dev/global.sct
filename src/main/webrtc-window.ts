import { BrowserWindow, ipcMain } from 'electron'
import type { IpcMainEvent } from 'electron'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { IpcEvents, WebRtcCommand, WebRtcEvent } from '../shared/api'

export class WebRtcWindow {
  readonly window: BrowserWindow
  private readonly ready: Promise<void>
  private closed = false
  private readonly receive: (event: IpcMainEvent, value: IpcEvents['webrtc:event'][0]) => void

  constructor(onEvent: (event: WebRtcEvent) => void) {
    this.window = new BrowserWindow({
      show: false,
      width: 1,
      height: 1,
      webPreferences: {
        preload: join(__dirname, '../preload/webrtc.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        partition: `sct-webrtc-${randomUUID()}`
      }
    })
    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    this.window.webContents.on('will-navigate', (event) => event.preventDefault())
    this.window.webContents.on('will-attach-webview', (event) => event.preventDefault())
    this.window.webContents.session.on('will-download', (event) => event.preventDefault())
    this.window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    this.window.webContents.session.setPermissionCheckHandler(() => false)
    this.receive = (event, value) => {
      if (event.sender !== this.window.webContents) return
      onEvent(requireEvent(value))
    }
    ipcMain.on('webrtc:event', this.receive)
    this.ready = this.window.loadFile(join(__dirname, '../renderer/webrtc.html')).then(() => undefined)
    this.window.once('closed', () => { this.closed = true; ipcMain.removeListener('webrtc:event', this.receive) })
  }

  async command(command: WebRtcCommand): Promise<void> {
    await this.ready
    if (this.closed || this.window.isDestroyed()) throw new Error('The WebRTC window is unavailable.')
    sendToWebRtcWindow(this.window, 'webrtc:command', command)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    ipcMain.removeListener('webrtc:event', this.receive)
    if (!this.window.isDestroyed()) this.window.destroy()
  }
}

function sendToWebRtcWindow<C extends 'webrtc:command' | 'webrtc:event'>(window: BrowserWindow, channel: C, ...args: IpcEvents[C]): void {
  window.webContents.send(channel, ...args)
}

function requireEvent(value: unknown): WebRtcEvent {
  if (typeof value !== 'object' || value === null || !('type' in value)) throw new Error('The WebRTC event is invalid.')
  const type = value.type
  if (type === 'offer' || type === 'answer') {
    if (!('sdp' in value) || typeof value.sdp !== 'string' || !value.sdp) throw new Error('The WebRTC SDP is invalid.')
    return { type, sdp: value.sdp }
  }
  if (type === 'message') {
    if (!('data' in value) || typeof value.data !== 'string') throw new Error('The WebRTC message is invalid.')
    return { type, data: value.data }
  }
  if (type === 'error') {
    if (!('error' in value) || typeof value.error !== 'string') throw new Error('The WebRTC error is invalid.')
    return { type, error: value.error }
  }
  if (type === 'route') {
    if (!('route' in value) || (value.route !== 'direct' && value.route !== 'turn')) throw new Error('The WebRTC route is invalid.')
    return { type, route: value.route }
  }
  if (type === 'ready' || type === 'connected' || type === 'close') return { type }
  throw new Error('The WebRTC event is invalid.')
}
