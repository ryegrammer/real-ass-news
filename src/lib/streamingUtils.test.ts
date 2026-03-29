import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  connectToStream,
  disconnectFromStream,
  startRecording,
  stopRecording,
  getSavedRecordings
} from './streamingUtils'

describe('streamingUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset Math.random for predictable tests
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  describe('connectToStream', () => {
    it('should resolve successfully most of the time', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5) // > 0.1, so success

      await expect(connectToStream('high')).resolves.toBeUndefined()
    })

    it('should reject occasionally to simulate connection failures', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05) // < 0.1, so failure

      await expect(connectToStream()).rejects.toThrow('Connection failed')
    })

    it('should accept different quality parameters', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      await expect(connectToStream('low')).resolves.toBeUndefined()
      await expect(connectToStream('medium')).resolves.toBeUndefined()
      await expect(connectToStream('auto')).resolves.toBeUndefined()
    })

    it('should handle default quality parameter', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      await expect(connectToStream()).resolves.toBeUndefined()
    })
  })

  describe('disconnectFromStream', () => {
    it('should always resolve successfully', async () => {
      await expect(disconnectFromStream()).resolves.toBeUndefined()
    })

    it('should complete within reasonable time', async () => {
      const start = Date.now()
      await disconnectFromStream()
      const end = Date.now()

      // Should complete in less than 1 second (800ms + buffer)
      expect(end - start).toBeLessThan(1000)
    })
  })

  describe('startRecording', () => {
    it('should return a recording ID', async () => {
      const options = {
        name: 'Test Recording',
        quality: 90,
        autoSave: true
      }

      const recordingId = await startRecording(options)

      expect(recordingId).toMatch(/^rec_\d+$/)
      expect(recordingId).toContain('rec_')
    })

    it('should generate unique recording IDs', async () => {
      const options = {
        name: 'Test Recording 1',
        quality: 80,
        autoSave: false
      }

      // Use fake timers to control Date.now
      vi.useFakeTimers()
      vi.setSystemTime(1000)
      const id1 = await startRecording(options)
      vi.setSystemTime(2000)
      const id2 = await startRecording({ ...options, name: 'Test Recording 2' })
      vi.useRealTimers()

      expect(id1).toBe('rec_1000')
      expect(id2).toBe('rec_2000')
      expect(id1).not.toBe(id2)
    })
  })

  describe('stopRecording', () => {
    it('should return recording metadata', async () => {
      const recordingId = 'rec_12345'

      const result = await stopRecording(recordingId)

      expect(result).toHaveProperty('id', recordingId)
      expect(result).toHaveProperty('duration')
      expect(result).toHaveProperty('size')
      expect(result.duration).toMatch(/^\d+:\d{2}$/) // Format: MM:SS
      expect(['720p', '1080p']).toContain(result.size)
    })

    it('should generate valid duration format', async () => {
      // Mock Math.random to control duration generation
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // 30 minutes
        .mockReturnValueOnce(0.25) // 15 seconds

      const result = await stopRecording('test_id')

      expect(result.duration).toBe('31:15')
    })

    it('should handle different recording IDs', async () => {
      const id1 = 'rec_test1'
      const id2 = 'rec_test2'

      const result1 = await stopRecording(id1)
      const result2 = await stopRecording(id2)

      expect(result1.id).toBe(id1)
      expect(result2.id).toBe(id2)
    })
  })

  describe('getSavedRecordings', () => {
    it('should return an array of recordings', async () => {
      const recordings = await getSavedRecordings()

      expect(Array.isArray(recordings)).toBe(true)
      expect(recordings).toHaveLength(2)
    })

    it('should return recordings with correct structure', async () => {
      const recordings = await getSavedRecordings()

      recordings.forEach(recording => {
        expect(recording).toHaveProperty('id')
        expect(recording).toHaveProperty('name')
        expect(recording).toHaveProperty('date')
        expect(recording).toHaveProperty('duration')
        expect(recording).toHaveProperty('size')
        expect(typeof recording.id).toBe('number')
        expect(typeof recording.name).toBe('string')
        expect(typeof recording.date).toBe('string')
        expect(typeof recording.duration).toBe('string')
        expect(typeof recording.size).toBe('string')
      })
    })

    it('should return expected sample recordings', async () => {
      const recordings = await getSavedRecordings()

      expect(recordings[0]).toEqual({
        id: 1,
        name: 'Science Lesson 1',
        date: '2023-06-15',
        duration: '34:21',
        size: '720p'
      })

      expect(recordings[1]).toEqual({
        id: 2,
        name: 'Coding Tutorial',
        date: '2023-06-12',
        duration: '45:52',
        size: '1080p'
      })
    })
  })
})