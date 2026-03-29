import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  initPiCamera,
  startPiCameraStream,
  stopPiCameraStream,
  capturePhoto,
  startRecording,
  getCameraStatus
} from './piCameraUtils'

// Mock global objects
const mockGetUserMedia = vi.fn()
const mockMediaDevices = {
  getUserMedia: mockGetUserMedia
}

Object.defineProperty(global, 'navigator', {
  writable: true,
  value: {
    mediaDevices: mockMediaDevices
  }
})

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  ondataavailable: null,
  onstop: null,
} as any

global.MediaRecorder = vi.fn().mockImplementation(function () { return mockMediaRecorder; })

// Mock canvas and video elements
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
  })),
  toDataURL: vi.fn(() => 'data:image/jpeg;base64,mockimage')
}

const mockVideo = {
  videoWidth: 1280,
  videoHeight: 720,
  addEventListener: vi.fn(),
  srcObject: null
}

Object.defineProperty(global, 'document', {
  writable: true,
  value: {
    createElement: vi.fn((tag: string) => {
      if (tag === 'canvas') return mockCanvas
      if (tag === 'video') return mockVideo
      return {}
    })
  }
})

describe('piCameraUtils', () => {
  beforeEach(async () => {
    // Reset module-level streamConnection state from previous test
    try { await stopPiCameraStream() } catch {}
    vi.clearAllMocks()
    // Re-setup MediaRecorder mock after clearAllMocks
    ;(global.MediaRecorder as any) = vi.fn().mockImplementation(function () { return mockMediaRecorder; })
    mockMediaRecorder.start = vi.fn()
    mockMediaRecorder.stop = vi.fn()
  })

  describe('initPiCamera', () => {
    it('should return true when getUserMedia succeeds', async () => {
      const mockStream = { getTracks: vi.fn(() => []) }
      mockGetUserMedia.mockResolvedValue(mockStream)

      const result = await initPiCamera()

      expect(result).toBe(true)
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true
      })
    })

    it('should fallback to Pi camera server when getUserMedia fails', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'))

      const result = await initPiCamera()

      expect(result).toBe(true) // Should return true from fallback
      expect(mockGetUserMedia).toHaveBeenCalled()
    })
  })

  describe('startPiCameraStream', () => {
    it('should start stream with local media when available', async () => {
      const mockStream = { getTracks: vi.fn(() => []) }
      mockGetUserMedia.mockResolvedValue(mockStream)

      // Initialize camera first
      await initPiCamera()

      const mockVideoElement = {
        srcObject: null,
        play: vi.fn().mockResolvedValue(undefined)
      } as any

      const result = await startPiCameraStream(mockVideoElement, 'high')

      expect(result).toBe('local-stream')
      expect(mockVideoElement.srcObject).toBe(mockStream)
      expect(mockVideoElement.play).toHaveBeenCalled()
    })

    it('should return WebSocket URL when no local stream', async () => {
      const mockVideoElement = {} as HTMLVideoElement

      const result = await startPiCameraStream(mockVideoElement, 'medium')

      expect(result).toBe('ws://raspberry-pi.local:8080/camera-stream?quality=medium')
    })

    it('should handle different quality settings', async () => {
      const mockVideoElement = {} as HTMLVideoElement

      const lowQuality = await startPiCameraStream(mockVideoElement, 'low')
      const autoQuality = await startPiCameraStream(mockVideoElement, 'auto')

      expect(lowQuality).toContain('quality=low')
      expect(autoQuality).toContain('quality=auto')
    })
  })

  describe('stopPiCameraStream', () => {
    it('should stop all tracks when stream exists', async () => {
      const mockTrack = { stop: vi.fn() }
      const mockStream = { getTracks: vi.fn(() => [mockTrack, mockTrack]) }
      mockGetUserMedia.mockResolvedValue(mockStream)

      // Initialize camera first
      await initPiCamera()

      // Stop the stream
      await stopPiCameraStream()

      expect(mockTrack.stop).toHaveBeenCalledTimes(2)
    })

    it('should not throw when no stream exists', async () => {
      await expect(stopPiCameraStream()).resolves.not.toThrow()
    })
  })

  describe('capturePhoto', () => {
    it('should capture photo from stream', async () => {
      const mockStream = { getTracks: vi.fn(() => []) }
      mockGetUserMedia.mockResolvedValue(mockStream)

      // Initialize camera first
      await initPiCamera()

      // Mock video loadedmetadata event
      mockVideo.addEventListener.mockImplementation((event, callback) => {
        if (event === 'loadedmetadata') {
          setTimeout(callback, 0)
        }
      })

      const result = await capturePhoto()

      expect(result).toBe('data:image/jpeg;base64,mockimage')
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d')
    })

    it('should throw error when no active stream', async () => {
      await expect(capturePhoto()).rejects.toThrow('No active camera stream')
    })
  })

  describe('startRecording', () => {
    it('should start recording with MediaRecorder', async () => {
      const mockStream = { getTracks: vi.fn(() => []) }
      mockGetUserMedia.mockResolvedValue(mockStream)

      // Initialize camera first
      await initPiCamera()

      const result = await startRecording()

      expect(result).toBe(mockMediaRecorder)
      expect(mockMediaRecorder.start).toHaveBeenCalled()
      expect(global.MediaRecorder).toHaveBeenCalledWith(mockStream, {
        mimeType: 'video/webm; codecs=vp9'
      })
    })

    it('should throw error when no stream available', async () => {
      await expect(startRecording()).rejects.toThrow('No active camera stream')
    })
  })

  describe('getCameraStatus', () => {
    it('should return correct status with local stream', async () => {
      const mockStream = { getTracks: vi.fn(() => []) }
      mockGetUserMedia.mockResolvedValue(mockStream)

      // Initialize camera
      await initPiCamera()

      const status = getCameraStatus()

      expect(status).toEqual({
        isConnected: false,
        hasLocalStream: true,
        streamType: 'local'
      })
    })

    it('should return none status when no stream', () => {
      const status = getCameraStatus()

      expect(status).toEqual({
        isConnected: false,
        hasLocalStream: false,
        streamType: 'none'
      })
    })
  })
})