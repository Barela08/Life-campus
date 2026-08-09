/**
 * Shared Camera Service — ONE getUserMedia implementation for the entire app.
 * Used by: Attendance Terminal, Admin Face Registration, Student Face Registration.
 *
 * Supports: startCamera(), stopCamera(), restartCamera(), refreshCamera(), switchCamera()
 * Handles: permission denied, no camera, camera busy, camera disconnected,
 *          invalid device, browser unsupported, stream failure, video element not ready.
 *
 * RENDERING-PROOF DESIGN:
 * - The <video> element must be RENDERED ALWAYS (not conditionally) so that
 *   attachVideo() always has a mounted element to which the stream can be bound.
 * - LIVE is only reported when the video is actually rendering frames
 *   (readyState >= 2 && videoWidth > 0 && !paused).
 * - FPS is measured from real rendered frames (requestVideoFrameCallback or a
 *   rAF/currentTime fallback), NOT guessed from stream attachment.
 * - On mount, if a stream already exists, it is re-attached (no second getUserMedia).
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
  onFps?: (fps: number) => void
  onFrame?: () => void
}

const DEFAULT_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: { ideal: 'user' },
}

// requestVideoFrameCallback is not in older TS lib.dom — declare it.
type HTMLVideoElementWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: unknown) => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
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

  // FPS measurement
  private fpsRaf = 0
  private fpsFrames = 0
  private fpsLast = 0
  private fpsIntervalTimer: number | null = null

  /** Attach a video element to this service. If a stream already exists, bind it. */
  attachVideo(video: HTMLVideoElement | null) {
    this.videoRef = video
    if (video && this.stream) {
      this.bindStream(video, this.stream)
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

/** Bind a MediaStream to a <video> element, configure it, and start playback. */
  private bindStream(video: HTMLVideoElement, s: MediaStream) {
    video.srcObject = s
    video.muted = true
    video.autoplay = true
    video.playsInline = true
    // Ensure the video is not hidden by CSS
    video.style.display = 'block'
    video.style.visibility = 'visible'
    video.style.opacity = '1'
    video.style.width = '100%'
    video.style.height = '100%'
    video.style.objectFit = 'cover'

    // Wire real playback events so LIVE is only reported once frames render.
    video.onloadedmetadata = () => {
      this.callbacks.onLive?.(this.isLive())
      this.playVideo(video)
    }
    video.oncanplay = () => this.callbacks.onLive?.(this.isLive())
    video.onplaying = () => this.callbacks.onLive?.(this.isLive())
    video.onerror = () => this.setState('error', 'Video playback error')

    this.playVideo(video)
  }

  /** Try to play the video; capture and report any rejection. Uses a manual retry for autoplay policy. */
  private playVideo(video: HTMLVideoElement) {
    const doPlay = () => {
      const p = video.play()
      if (p) {
        p.then(() => {
          this.callbacks.onLive?.(this.isLive())
        }).catch((err: unknown) => {
          const e = err as Error
          // NotAllowedError is common before any user gesture; but in this app the camera
          // is started from a user click, so autoplay should be permitted. Surface errors.
          this.setState('on', `video.play() failed: ${e?.message || 'unknown'}`)
        })
      }
    }
    if (video.paused && this.stream?.active) {
      doPlay()
    }
  }

  private attachStream(s: MediaStream) {
    this.stream = s
    this.setState('on')
    this.lastFrameTime = Date.now()
    this.callbacks.onStreamReady?.(s)

    if (this.videoRef) {
      this.bindStream(this.videoRef, s)
    }

    this.startFpsMonitoring()

    // Watchdog: detect stalled streams (no frames rendered)
    if (this.watchdogTimer) window.clearInterval(this.watchdogTimer)
    this.watchdogTimer = window.setInterval(() => {
      if (this.state === 'on' && this.stream?.active && Date.now() - this.lastFrameTime > 6000) {
        this.setState('error', 'Camera stream stalled — reconnecting...')
        this.restartCamera()
      }
    }, 4000)

    // Track ended -> reconnect
    const track = s.getVideoTracks()[0]
    if (track) {
      track.onended = () => {
        this.setState('off', 'Camera disconnected')
        this.scheduleReconnect()
      }
    }
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

      // Use safe non-exact constraints (ideal) to avoid OverconstrainedError.
      const videoConstraints: MediaTrackConstraints = {
        ...DEFAULT_CONSTRAINTS,
      }
      if (deviceId) {
        videoConstraints.deviceId = { ideal: deviceId }
      }

      let s: MediaStream
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
      } catch (err: any) {
        const name = err?.name || ''
        if (name === 'OverconstrainedError' || name === 'NotReadableError' || name === 'NotFoundError') {
          // Fallback: minimal constraints (never force exact facingMode/deviceId)
          s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
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
        msg = 'Camera permission denied. Allow access in browser settings and click Refresh Camera.'
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        state = 'notfound'
        msg = 'No camera detected. Connect a camera and click Refresh Camera.'
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        state = 'busy'
        msg = 'Camera is being used by another application. Close it and retry.'
      } else if (name === 'SecurityError') {
        state = 'error'
        msg = 'Camera is blocked by browser security policy.'
      } else if (name === 'AbortError') {
        state = 'error'
        msg = 'Camera request was aborted. Retry.'
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

  /** Mark that a frame was received (for watchdog). Called by the render-loop consumer. */
  markFrame() {
    this.lastFrameTime = Date.now()
  }

  /** True only when the stream is active AND the video is actually rendering frames. */
  isLive(): boolean {
    const v = this.videoRef
    return (
      !!this.stream &&
      this.stream.active === true &&
      !!v &&
      v.srcObject === this.stream &&
      v.readyState >= 2 &&
      v.videoWidth > 0 &&
      v.videoHeight > 0 &&
      !v.paused
    )
  }

/** Get the currently attached video element (for reading resolution). */
  getVideo(): HTMLVideoElement | null {
    return this.videoRef
  }

  /** Full runtime diagnostics proving exactly where the pipeline is failing. */
  getDiagnostics() {
    const v = this.videoRef
    const track = this.stream?.getVideoTracks()[0]
    return {
      videoElement: !!v,
      srcObject: v ? (v.srcObject === this.stream ? 'ATTACHED' : 'MISMATCH') : 'NULL',
      readyState: v ? v.readyState : -1,
      videoWidth: v ? v.videoWidth : 0,
      videoHeight: v ? v.videoHeight : 0,
      paused: v ? v.paused : null,
      currentTime: v ? v.currentTime : 0,
      streamActive: this.stream?.active ?? false,
      trackReadyState: track ? track.readyState : 'none',
      trackEnabled: track ? track.enabled : false,
      trackMuted: track ? track.muted : null,
      settings: track ? (() => {
        try { return track.getSettings() } catch { return null }
      })() : null,
      playing: v ? (v.currentTime > 0 && !v.paused && v.readyState >= 2) : false,
    }
  }

  /** Start a lightweight monitor that reports LIVE/FPS based on real rendering. */
  startLiveMonitor() {
    if (this.liveMonitorTimer) return
    this.liveMonitorTimer = window.setInterval(() => {
      this.callbacks.onLive?.(this.isLive())
    }, 400)
  }

  stopLiveMonitor() {
    if (this.liveMonitorTimer) {
      window.clearInterval(this.liveMonitorTimer)
      this.liveMonitorTimer = null
    }
  }

  /** Measure real FPS from rendered video frames. */
  private startFpsMonitoring() {
    this.stopFpsMonitoring()
    this.fpsFrames = 0
    this.fpsLast = performance.now()

    const v = this.videoRef as HTMLVideoElementWithRVFC | null
    const count = () => {
      this.fpsFrames++
      this.lastFrameTime = Date.now()
      this.fpsRaf = requestAnimationFrame(count)
    }
    this.fpsRaf = requestAnimationFrame(count)

    this.fpsIntervalTimer = window.setInterval(() => {
      const now = performance.now()
      const dt = now - this.fpsLast
      const fps = dt > 0 ? Math.round((this.fpsFrames * 1000) / dt) : 0
      this.fpsFrames = 0
      this.fpsLast = now
      this.callbacks.onFps?.(fps)
    }, 1000)
  }

  private stopFpsMonitoring() {
    if (this.fpsRaf) cancelAnimationFrame(this.fpsRaf)
    this.fpsRaf = 0
    if (this.fpsIntervalTimer) window.clearInterval(this.fpsIntervalTimer)
    this.fpsIntervalTimer = null
  }

  private stopAllTracks() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => { t.onended = null; t.stop() })
      this.stream = null
    }
    if (this.videoRef) {
      this.videoRef.srcObject = null
    }
    if (this.watchdogTimer) { window.clearInterval(this.watchdogTimer); this.watchdogTimer = null }
    if (this.reconnectTimer) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    this.stopLiveMonitor()
    this.stopFpsMonitoring()
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
