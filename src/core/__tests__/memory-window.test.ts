import { describe, it, expect } from 'vitest'
import { splitMemoryWindow } from '../memory-window'
import { MEMORY_MAX_BYTES, MEMORY_MAX_LINES } from '../constants'

describe('splitMemoryWindow', () => {
  it('no overflow for small content', () => {
    const r = splitMemoryWindow('hello\nworld')
    expect(r.hasOverflow).toBe(false)
    expect(r.overflow).toBe('')
    expect(r.inWindow).toBe('hello\nworld')
  })

  it('splits at line boundary', () => {
    const content = Array.from({ length: MEMORY_MAX_LINES + 5 }, (_, i) => `line ${i}`).join('\n')
    const r = splitMemoryWindow(content)
    expect(r.hasOverflow).toBe(true)
    expect(r.inWindow.split('\n')).toHaveLength(MEMORY_MAX_LINES)
    expect(r.totalLines).toBe(MEMORY_MAX_LINES + 5)
  })

  it('splits at byte boundary when byte budget hits first', () => {
    const content = 'a'.repeat(MEMORY_MAX_BYTES + 100)
    const r = splitMemoryWindow(content)
    expect(r.hasOverflow).toBe(true)
    expect(r.inWindow.length).toBeLessThanOrEqual(MEMORY_MAX_BYTES)
  })

  it('handles empty input', () => {
    const r = splitMemoryWindow('')
    expect(r.hasOverflow).toBe(false)
    expect(r.totalLines).toBe(1)
    expect(r.totalBytes).toBe(0)
  })
})
