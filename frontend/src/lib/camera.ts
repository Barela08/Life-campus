/**
 * Shared Camera Service — ONE getUserMedia implementation for the entire app.
 * Used by: Attendance Terminal, Admin Face Registration, Student Face Registration.
 *
 * Supports: startCamera(), stopCamera(), restartCamera(), refreshCamera(), switchCamera()
 * Handles: permission denied, no camera, camera busy, camera disconnected,
 *          invalid device, browser unsupported, stream failure, video element not ready.
 */

export type CameraState = 'off' | 'opening' | 'on' | 'error' | 'denied' | 'busy' | 'notfound' | 'unsupported'

export interface CameraErrorInfo {
  state: CameraState
  message: string
}

export interface CameraHandle {
  stream: MediaStream | null
  state: CameraState
  error: string
  deviceId: string
  videoWidth: number
  videoHeight: number
}

export interface CameraCallbacks {
  onStateChange?: (state: CameraState, error?: string) => void
  onStreamReady?: (stream: MediaStream) => void
  onLive?: (live: boolean) => void
  onFrame?: () => void
}

const DEFAULT_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: 'user',
}

class CameraService {
  private stream: MediaStream | null = null
  private state: CameraState = 'off'
  private error = ''
  private deviceId = ''
  private videoRef: HTMLVideoElement | null = null
  private callbacks: CameraCallbacks = {}
  private reconnectTimer: number | null = null
  private watchdogTimer: number | null = null
  private liveMonitorTimer: number | null = null
  private lastFrameTime = 0
  private deviceList: MediaDeviceInfo[] = []

  /** Attach a video element to this service. */
  attachVideo(video: HTMLVideoElement | null) {
    this.videoRef = video
    if (video && this.stream) {
      video.srcObject = this.stream
      video.play().catch(() => {})
    }
  }

  /** Set callbacks for state changes. */
  setCallbacks(cb: CameraCallbacks) {
    this.callbacks = cb
  }

  getState(): CameraState {
    return this.state
  }

  getError(): string {
    return this.error
  }

  getStream(): MediaStream | null {
    return this.stream
  }

  getDeviceId(): string {
    return this.deviceId
  }

  private setState(state: CameraState, error = '') {
    this.state = state
    this.error = error
    this.callbacks.onStateChange?.(state, error)
  }

  private attachStream(s: MediaStream) {
    this.stream = s
    this.setState('on')
    this.lastFrameTime = Date.now()
    this.callbacks.onStreamReady?.(s)

    if (this.videoRef) {
      this.videoRef.srcObject = s
      this.videoRef.muted = true
      this.videoRef.autoplay = true
      this.videoRef.playsInline = true
      this.videoRef.play().catch(() => {})
    }

    // Watchdog: detect stalled streams
    if (this.watchdogTimer) window.clearInterval(this.watchdogTimer)
    this.watchdogTimer = window.setInterval(() => {
      if (this.state === 'on' && Date.now() - this.lastFrameTime > 4000) {
        this.setState('error', 'Camera stream stalled — reconnecting...')
        this.restartCamera()
      }
    }, 3000)

    // Track ended -> reconnect
    s.getVideoTracks()[0]?.addEventListener('ended', () => {
      this.setState('off', 'Camera disconnected')
      this.scheduleReconnect()
    })
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.restartCamera()
    }, 2000)
  }

  /** Start the camera. */
  async startCamera(deviceId?: string): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.setState('unsupported', 'Camera not supported in this browser')
      return false
    }

    this.stopAllTracks()
    this.setState('opening')
    this.error = ''

    try {
      await this.refreshCamera()

      const videoConstraints: MediaTrackConstraints = { ...DEFAULT_CONSTRAINTS }
      if (deviceId) {
        videoConstraints.deviceId = deviceId
      }

      let s: MediaStream
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
      } catch (err: any) {
        const name = err?.name || ''
        if (name === 'OverconstrainedError' || name === 'NotReadableError' || name === 'NotFoundError') {
          // Fallback: minimal constraints
          s = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { deviceId: { exact: deviceId } } : true,
            audio: false,
          })
        } else {
          throw err
        }
      }

      this.deviceId = s.getVideoTracks()[0]?.getSettings().deviceId || deviceId || ''
      this.attachStream(s)
      return true
    } catch (err: any) {
      const name = err?.name || ''
      let msg = 'Failed to open camera'
      let state: CameraState = 'error'

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        state = 'denied'
        msg = 'Camera permission denied. Allow access in browser settings and retry.'
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        state = 'notfound'
        msg = 'No camera found. Connect a camera and retry.'
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        state = 'busy'
        msg = 'Camera is busy or in use by another app. Close other apps and retry.'
      } else {
        state = 'error'
        msg = `Camera error: ${err.message || name || 'Unknown error'}`
      }

      this.setState(state, msg)
      return false
    }
  }

  /** Stop the camera and release all tracks. */
  stopCamera() {
    this.stopAllTracks()
    this.setState('off')
  }

  /** Restart the camera with the same device. */
  async restartCamera(): Promise<boolean> {
    return this.startCamera(this.deviceId || undefined)
  }

  /** Refresh the camera device list. */
  async refreshCamera(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      this.deviceList = devices.filter(d => d.kind === 'videoinput')
      return this.deviceList
    } catch {
      return this.deviceList
    }
  }

  /** Switch to the next available camera. */
  async switchCamera(): Promise<boolean> {
    await this.refreshCamera()
    if (this.deviceList.length === 0) return false
    const current = this.stream?.getVideoTracks()[0]?.getSettings().deviceId
    const idx = current ? this.deviceList.findIndex(d => d.deviceId === current) : -1
    const next = this.deviceList[(idx + 1) % this.deviceList.length]
    if (next) {
      return this.startCamera(next.deviceId)
    }
    return false
  }

  /** Get list of available cameras. */
  getCameras(): MediaDeviceInfo[] {
    return this.deviceList
  }

  /** Capture the current video frame as a JPEG data URL. Returns null if not ready. */
  captureFrame(): string | null {
    if (!this.videoRef) return null
    const video = this.videoRef
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
      return null
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  /** Check if the video frame is ready for capture. */
  isFrameReady(): boolean {
    return !!this.videoRef && this.videoRef.videoWidth > 0 && this.videoRef.videoHeight > 0 && this.videoRef.readyState >= 2
  }

  /** Mark that a frame was received (for watchdog). */
  markFrame() {
    this.lastFrameTime = Date.now()
  }

  /** True when a stream is attached AND the video is actually rendering frames. */
  isLive(): boolean {
    const v = this.videoRef
    return (
      !!this.stream &&
      this.stream.active === true &&
      !!v &&
      v.readyState >= 2 &&
      v.videoWidth > 0 &&
      v.videoHeight > 0
    )
  }

  /** Get the currently attached video element (for reading resolution). */
  getVideo(): HTMLVideoElement | null {
    return this.videoRef
  }

  /**
   * Start a lightweight monitor that flags when the attached video element
   * actually begins rendering (readyState >= 2 && videoWidth > 0). This lets
   * consumers show an accurate "● CAMERA LIVE" instead of guessing based on
   * the stream being attached before the <video> mounted.
   */
  startLiveMonitor() {
    if (this.liveMonitorTimer) return
    this.liveMonitorTimer = window.setInterval(() => {
      this.callbacks.onLive?.(this.isLive())
    }, 500)
  }

  stopLiveMonitor() {
    if (this.liveMonitorTimer) {
      window.clearInterval(this.liveMonitorTimer)
      this.liveMonitorTimer = null
    }
  }

  private stopAllTracks() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => { t.onended = null; t.stop() })
      this.stream = null
    }
    if (this.videoRef) this.videoRef.srcObject = null
    if (this.watchdogTimer) { window.clearInterval(this.watchdogTimer); this.watchdogTimer = null }
    if (this.reconnectTimer) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    this.stopLiveMonitor()
  }

  /** Clean up all resources. */
  dispose() {
    this.stopAllTracks()
    this.callbacks = {}
  }
}

// Singleton instance shared across the entire app
export const cameraService = new CameraService()

/** Convenience hook-friendly helper to attach a video element. */
export function attachCameraVideo(video: HTMLVideoElement | null) {
  cameraService.attachVideo(video)
}
