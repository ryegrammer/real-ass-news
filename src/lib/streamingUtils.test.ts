import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  connectToStream,
  disconnectFromStream,
  startRecording,
  stopRecording,
  getSavedRecordings
} from './streamingUtils'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  })
}

describe('streamingUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('connectToStream', () => {
    it('should POST to /api/camera/start with the given quality', async () => {
      mockFetch.mockReturnValue(jsonResponse({ status: 'started', quality: 'high' }))

      await connectToStream('high')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toContain('/api/camera/start')
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body)).toEqual({ quality: 'high' })
    })

    it('should default to medium quality', async () => {
      mockFetch.mockReturnValue(jsonResponse({ status: 'started', quality: 'medium' }))

      await connectToStream()

      const [, options] = mockFetch.mock.calls[0]
      expect(JSON.parse(options.body)).toEqual({ quality: 'medium' })
    })

    it('should throw on server error', async () => {
      mockFetch.mockReturnValue(jsonResponse({ error: 'fail' }, 500))

      await expect(connectToStream()).rejects.toThrow()
    })
  })

  describe('disconnectFromStream', () => {
    it('should POST to /api/camera/stop', async () => {
      mockFetch.mockReturnValue(jsonResponse({ status: 'stopped' }))

      await disconnectFromStream()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toContain('/api/camera/stop')
      expect(options.method).toBe('POST')
    })
  })

  describe('startRecording', () => {
    it('should POST to /api/camera/record/start and return an id', async () => {
      mockFetch.mockReturnValue(jsonResponse({ id: 'rec_123' }))

      const id = await startRecording({ name: 'Test', quality: 720, autoSave: true })

      expect(id).toBe('rec_123')
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toContain('/api/camera/record/start')
      expect(JSON.parse(options.body)).toEqual({ name: 'Test', quality: 'medium' })
    })

    it('should map quality numbers to labels', async () => {
      mockFetch.mockReturnValue(jsonResponse({ id: 'rec_1' }))

      await startRecording({ name: 'HD', quality: 1080, autoSave: false })
      expect(JSON.parse(mockFetch.mock.calls[0][1].body).quality).toBe('high')

      mockFetch.mockClear()
      mockFetch.mockReturnValue(jsonResponse({ id: 'rec_2' }))

      await startRecording({ name: 'Low', quality: 480, autoSave: false })
      expect(JSON.parse(mockFetch.mock.calls[0][1].body).quality).toBe('low')
    })
  })

  describe('stopRecording', () => {
    it('should POST to /api/camera/record/stop and return metadata', async () => {
      const mockResult = { id: 'rec_123', duration: '5:30', size: '720p' }
      mockFetch.mockReturnValue(jsonResponse(mockResult))

      const result = await stopRecording('rec_123')

      expect(result).toEqual(mockResult)
    })
  })

  describe('getSavedRecordings', () => {
    it('should GET /api/camera/recordings', async () => {
      const mockRecordings = [
        { id: 1, name: 'Lesson 1', date: '2024-01-01', duration: '10:00', size: '720p' },
      ]
      mockFetch.mockReturnValue(jsonResponse(mockRecordings))

      const recordings = await getSavedRecordings()

      expect(recordings).toEqual(mockRecordings)
    })

    it('should return empty array when endpoint is unavailable', async () => {
      mockFetch.mockReturnValue(jsonResponse({ error: 'not found' }, 404))

      const recordings = await getSavedRecordings()

      expect(recordings).toEqual([])
    })
  })
})
