import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme, type Theme } from './useTheme'

// Mock react-use
vi.mock('react-use', () => ({
  useLocalStorage: vi.fn()
}))

// Mock document.documentElement
const mockClassList = {
  remove: vi.fn(),
  add: vi.fn(),
}

Object.defineProperty(document, 'documentElement', {
  writable: true,
  value: {
    classList: mockClassList
  }
})

describe('useTheme', () => {
  const mockSetTheme = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset the mock implementation
    const { useLocalStorage } = await import('react-use')
    vi.mocked(useLocalStorage).mockReturnValue(['bright', mockSetTheme])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return default theme as bright', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('bright')
    expect(typeof result.current.toggleTheme).toBe('function')
    expect(typeof result.current.initializeTheme).toBe('function')
  })

  it('should toggle from bright to galactic', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(mockSetTheme).toHaveBeenCalledWith('galactic')
    expect(mockClassList.remove).toHaveBeenCalledWith('dark', 'galactic')
    expect(mockClassList.add).toHaveBeenCalledWith('galactic')
  })

  it('should toggle from galactic to bright', async () => {
    // Mock galactic theme
    const { useLocalStorage } = await import('react-use')
    vi.mocked(useLocalStorage).mockReturnValue(['galactic', mockSetTheme])

    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(mockSetTheme).toHaveBeenCalledWith('bright')
    expect(mockClassList.remove).toHaveBeenCalledWith('dark', 'galactic')
    expect(mockClassList.add).not.toHaveBeenCalled()
  })

  it('should handle dark theme (legacy)', async () => {
    // Mock dark theme
    const { useLocalStorage } = await import('react-use')
    vi.mocked(useLocalStorage).mockReturnValue(['dark', mockSetTheme])

    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(mockSetTheme).toHaveBeenCalledWith('bright')
  })

  it('should initialize theme correctly for bright', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.initializeTheme()
    })

    expect(mockClassList.remove).toHaveBeenCalledWith('dark', 'galactic')
    expect(mockClassList.add).not.toHaveBeenCalled()
  })

  it('should initialize theme correctly for galactic', async () => {
    const { useLocalStorage } = await import('react-use')
    vi.mocked(useLocalStorage).mockReturnValue(['galactic', mockSetTheme])

    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.initializeTheme()
    })

    expect(mockClassList.remove).toHaveBeenCalledWith('dark', 'galactic')
    expect(mockClassList.add).toHaveBeenCalledWith('galactic')
  })

  it('should handle null theme from localStorage', async () => {
    const { useLocalStorage } = await import('react-use')
    vi.mocked(useLocalStorage).mockReturnValue([null, mockSetTheme])

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('bright') // Should default to bright
  })

  it('should handle undefined theme from localStorage', async () => {
    const { useLocalStorage } = await import('react-use')
    vi.mocked(useLocalStorage).mockReturnValue([undefined, mockSetTheme])

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('bright') // Should default to bright

    act(() => {
      result.current.toggleTheme()
    })

    expect(mockSetTheme).toHaveBeenCalledWith('galactic') // Should toggle from bright
  })
})