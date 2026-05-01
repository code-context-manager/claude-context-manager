import { MEMORY_MAX_BYTES, MEMORY_MAX_LINES } from './constants'

export interface MemorySplit {
  /** The portion of MEMORY.md that fits inside the loading window. */
  inWindow: string
  /** The portion beyond the 200-line / 25KB boundary — still indexed on the node. */
  overflow: string
  hasOverflow: boolean
  /** Byte length (utf-8) of the full memory file. */
  totalBytes: number
  /** Line count of the full memory file. */
  totalLines: number
}

/**
 * Split a MEMORY.md body at Claude Code's loading boundary: the first 200
 * lines OR 25KB, whichever comes first. The overflow portion is not loaded
 * into the session but is still visible to the user so they can see what
 * they're losing.
 */
export function splitMemoryWindow(content: string): MemorySplit {
  const lines = content.split('\n')
  const totalLines = lines.length
  const totalBytes = byteLength(content)

  let cutByLine = content.length
  if (totalLines > MEMORY_MAX_LINES) {
    cutByLine = lines.slice(0, MEMORY_MAX_LINES).join('\n').length
  }

  const cut = Math.min(cutByLine, MEMORY_MAX_BYTES)
  if (totalBytes <= MEMORY_MAX_BYTES && totalLines <= MEMORY_MAX_LINES) {
    return {
      inWindow: content,
      overflow: '',
      hasOverflow: false,
      totalBytes,
      totalLines,
    }
  }

  // Walk the string by UTF-16 length until we hit the byte cut. Simpler than
  // encoding the whole thing into bytes.
  let charCut = 0
  let byteCount = 0
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i)
    const size = ch < 0x80 ? 1 : ch < 0x800 ? 2 : 3
    if (byteCount + size > cut) break
    byteCount += size
    charCut = i + 1
  }

  return {
    inWindow: content.slice(0, charCut),
    overflow: content.slice(charCut),
    hasOverflow: true,
    totalBytes,
    totalLines,
  }
}

function byteLength(s: string): number {
  // Approximate utf-8 byte length without Buffer (shared layer is env-neutral).
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) n += 1
    else if (c < 0x800) n += 2
    else n += 3
  }
  return n
}
