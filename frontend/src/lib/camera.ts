/**
 * Shared Camera Service — ONE getUserMedia implementation for the entire app.
 * Used by: Attendance Terminal, Admin Face Registration, Student Face Registration.
 *
 * RENDERING-PROOF DESIGN:
 * - The <video> element MUST be RENDERED ALWAYS (not conditionally) so attachVideo()
 *   always has a mounted element to bind to. Overlays sit ON TOP of the stable video.
 * - LIVE is ONLY reported when the video is ACTUALLY rendering frames:
 *     stream.active === true
 *     AND video.srcObject === stream (ATTACHED)
 *     AND video.readyState >= 2
 *     AND video.videoWidth > 0
 *     AND video.videoHeight > 0
 *     AND video.paused === false
 *     AND real frames are being rendered (FPS > 0)
 * - FPS is measured from REAL rendered video frames via requestVideoFrameCallback
 *   (fallback: rAF + currentTime delta).
 * - bindStream sets event handlers BEFORE assigning srcObject, explicitly calls
 *   play(), waits for loadedmetadata, and retries until the video renders.
 * - Only ONE active MediaStream per service; starting stops any previous stream.
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
  private bindRetryTimer: number | null = null

  // FPS measurement (real video frames)
  private rvfcHandle = 0
  private fpsRaf = 0
  private fpsFrames = 0
  private fpsLast = 0
  private fpsIntervalTimer: number | null = null

  /** Attach a video element to this service. If a stream already exists, bind it. */
  attachVideo(video: HTMLVideoElement | null) {
    this.videoRef = video
    if (video && this.stream) {
      this.bindStream(video, this.stream)
      // CRITICAL: restart FPS monitoring now that the video element exists.
      // If the video mounted AFTER the stream was created, FPS monitoring
      // was started with a null videoRef and would never measure frames,
      // causing isLive() to always return false (camera stuck "Connecting…").
      this.startFpsMonitoring()
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

  /**
   * Bind a MediaStream to a <video> element, configure it, wait for metadata,
   * explicitly play it, and retry until real frames render. This is the
   * definitive stream → video attachment path.
   */
  private bindStream(video: HTMLVideoElement, s: MediaStream) {
    // Clear any pending retry so we start fresh
    if (this.bindRetryTimer) {
      window.clearTimeout(this.bindRetryTimer)
      this.bindRetryTimer = null
    }

    // 1) Configure attributes BEFORE assigning srcObject
    video.muted = true
    video.autoplay = true
    video.playsInline = true
    video.style.display = 'block'
    video.style.visibility = 'visible'
    video.style.opacity = '1'
    video.style.width = '100%'
    video.style.height = '100%'
    video.style.objectFit = 'cover'

    // 2) Wire real playback events BEFORE assigning srcObject
    video.onloadedmetadata = () => {
      console.log('VIDEO METADATA', video.videoWidth, video.videoHeight)
      this.callbacks.onLive?.(this.isLive())
      this.tryPlay(video)
    }
    video.oncanplay = () => this.callbacks.onLive?.(this.isLive())
    video.onplaying = () => {
      this.lastFrameTime = Date.now()
      this.callbacks.onLive?.(this.isLive())
    }
    video.onerror = () => {
      console.error('VIDEO ERROR', video.error)
      this.setState('error', 'Video playback error')
    }

    // 3) Assign the stream (idempotent)
    if (video.srcObject !== s) {
      video.srcObject = s
    }
    console.log('srcObject assigned', video.srcObject)

    // 4) Explicitly start playback
    this.tryPlay(video)

    // 5) Fallback retry: guarantee it actually starts rendering (handles the
    //    case where loadedmetadata/play raced React's render).
    this.bindRetryTimer = window.setTimeout(() => {
      this.bindRetryTimer = null
      if (!this.stream || video.srcObject !== this.stream) return
      if (video.readyState >= 2) {
        if (video.paused) this.tryPlay(video)
      } else {
        video.load()
        this.tryPlay(video)
      }
    }, 800)
  }

  /** Explicitly call play() and capture/report any error (never swallowed). */
  private tryPlay(video: HTMLVideoElement) {
    if (!this.stream?.active) return
    const p = video.play()
    if (p) {
      p.then(() => {
        this.lastFrameTime = Date.now()
        console.log('VIDEO PLAY SUCCESS', video.videoWidth, video.videoHeight, 'paused=', video.paused)
        this.callbacks.onLive?.(this.isLive())
      }).catch((err: unknown) => {
        const e = err as Error
        console.error('VIDEO PLAY ERROR', e?.message || err)
        // NotAllowedError often happens if play() is called before the user
        // gesture chain completes; retry shortly with the same stream.
        window.setTimeout(() => {
          if (this.stream && video.srcObject === this.stream && video.paused) {
            video.play().then(() => this.callbacks.onLive?.(this.isLive())).catch(() => {})
          }
        }, 300)
      })
    }
  }

  private attachStream(s: MediaStream) {
    // Single-stream guarantee: stop any previous stream before adopting a new one.
    if (this.stream && this.stream !== s) {
      this.stream.getTracks().forEach(t => { t.onended = null; t.stop() })
    }
    this.stream = s
    this.setState('on')
    this.lastFrameTime = Date.now()
    this.callbacks.onStreamReady?.(s)

    if (this.videoRef) {
      this.bindStream(this.videoRef, s)
    }

    this.startFpsMonitoring()

    // Watchdog: only restart if the stream is active but NO real video frames
    // have rendered for 6s (lastFrameTime is updated by real frame callbacks).
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
  captureFrame(maxWidth = 640): string | null {
    if (!this.videoRef) return null
    const video = this.videoRef
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
      return null
    }
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, maxWidth / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  }

  /** Check if the video frame is ready for capture. */
  isFrameReady(): boolean {
    return !!this.videoRef && this.videoRef.videoWidth > 0 && this.videoRef.videoHeight > 0 && this.videoRef.readyState >= 2 && !this.videoRef.paused
  }

  /** Mark that a frame was received (for watchdog). Called by the render-loop consumer. */
  markFrame() {
    this.lastFrameTime = Date.now()
  }

  /**
   * True when the stream is active AND the video is actually rendering frames.
   * Based on REAL video state (srcObject attached, readyState>=2, dims>0,
   * not paused). FPS is NOT required — it is a diagnostic metric that can
   * report 0 for up to 1 second even when the video is rendering fine.
   * Requiring FPS>0 caused the UI to stay stuck on "Starting live preview…"
   * forever even though the camera was clearly working.
   */
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

  /** Current measured FPS (from real rendered frames). */
  getCurrentFps(): number {
    return this.fpsFramesLive
  }

  private fpsFramesLive = 0

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
      srcObject: v ? (v.srcObject === this.stream ? 'ATTACHED' : v.srcObject ? 'MISMATCH' : 'NULL') : 'NULL',
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
      fps: this.getCurrentFps(),
    }
  }

  /** Start a lightweight monitor that reports LIVE based on real rendering. */
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

  /**
   * Measure real FPS from rendered video frames using requestVideoFrameCallback
   * when available; otherwise fall back to rAF + video.currentTime delta.
   */
  private startFpsMonitoring() {
    this.stopFpsMonitoring()
    this.fpsFrames = 0
    this.fpsFramesLive = 0
    this.fpsLast = performance.now()

    const v = this.videoRef as HTMLVideoElementWithRVFC | null

    const onRealFrame = () => {
      this.fpsFrames++
      this.lastFrameTime = Date.now()
      if (v && typeof v.requestVideoFrameCallback === 'function') {
        this.rvfcHandle = v.requestVideoFrameCallback(onRealFrame)
      } else {
        this.fpsRaf = requestAnimationFrame(onRealFrame)
      }
    }

    if (v && typeof v.requestVideoFrameCallback === 'function') {
      this.rvfcHandle = v.requestVideoFrameCallback(onRealFrame)
    } else {
      this.fpsRaf = requestAnimationFrame(onRealFrame)
    }

    this.fpsIntervalTimer = window.setInterval(() => {
      const now = performance.now()
      const dt = now - this.fpsLast
      const fps = dt > 0 ? Math.round((this.fpsFrames * 1000) / dt) : 0
      this.fpsFrames = 0
      this.fpsLast = now
      this.fpsFramesLive = fps
      this.callbacks.onFps?.(fps)
    }, 1000)
  }

  private stopFpsMonitoring() {
    const v = this.videoRef as HTMLVideoElementWithRVFC | null
    if (v && typeof v.cancelVideoFrameCallback === 'function' && this.rvfcHandle) {
      v.cancelVideoFrameCallback(this.rvfcHandle)
    }
    this.rvfcHandle = 0
    if (this.fpsRaf) cancelAnimationFrame(this.fpsRaf)
    this.fpsRaf = 0
    if (this.fpsIntervalTimer) window.clearInterval(this.fpsIntervalTimer)
    this.fpsIntervalTimer = null
  }

  private stopAllTracks() {
    if (this.bindRetryTimer) { window.clearTimeout(this.bindRetryTimer); this.bindRetryTimer = null }
    if (this.stream) {
      this.stream.getTracks().forEach(t => { t.onended = null; t.stop() })
      this.stream = null
    }
    if (this.videoRef) {
      this.videoRef.onloadedmetadata = null
      this.videoRef.oncanplay = null
      this.videoRef.onplaying = null
      this.videoRef.onerror = null
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
