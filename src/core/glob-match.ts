/**
 * Minimal glob matcher sized for Claude Code rule `paths:` entries.
 * Supports: `*`, `**`, `?`, character classes `[...]`, brace alternation
 * `{a,b,c}`. POSIX-style forward slashes. Leading `!` negates.
 *
 * Not a full minimatch — deliberately small and dependency-free so it can
 * live in the shared layer.
 */

function globSegmentToRegex(glob: string): string {
  let out = ''
  let i = 0
  while (i < glob.length) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**` — match anything including path separators
        out += '.*'
        i += 2
        // Collapse `**/` to `(?:.*\/)?` so `**/foo.ts` also matches `foo.ts`
        if (glob[i] === '/') {
          out = out.slice(0, -2) + '(?:.*\\/)?'
          i += 1
        }
      } else {
        // `*` — match anything except `/`
        out += '[^/]*'
        i += 1
      }
    } else if (c === '?') {
      out += '[^/]'
      i += 1
    } else if (c === '[') {
      const end = glob.indexOf(']', i)
      if (end === -1) {
        out += '\\['
        i += 1
      } else {
        out += glob.slice(i, end + 1)
        i = end + 1
      }
    } else if (c === '{') {
      const end = glob.indexOf('}', i)
      if (end === -1) {
        out += '\\{'
        i += 1
      } else {
        const alts = glob
          .slice(i + 1, end)
          .split(',')
          .map(globSegmentToRegex)
        out += '(?:' + alts.join('|') + ')'
        i = end + 1
      }
    } else if ('\\^$+.()|'.includes(c)) {
      out += '\\' + c
      i += 1
    } else {
      out += c
      i += 1
    }
  }
  return out
}

function compileGlob(glob: string): { regex: RegExp; negate: boolean } {
  let pattern = glob.trim()
  let negate = false
  if (pattern.startsWith('!')) {
    negate = true
    pattern = pattern.slice(1)
  }
  return {
    regex: new RegExp('^' + globSegmentToRegex(pattern) + '$'),
    negate,
  }
}

/** Normalize a path to POSIX separators, no leading `./`. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '')
}

/** Does a single glob match the given path? */
export function matchGlob(glob: string, relPath: string): boolean {
  const { regex, negate } = compileGlob(glob)
  const match = regex.test(normalizePath(relPath))
  return negate ? !match : match
}

/**
 * Match a list of globs against a path. Returns true if any positive glob
 * matches AND no negative glob matches. Empty list returns false (no
 * trigger).
 */
export function matchAnyGlob(globs: string[], relPath: string): boolean {
  if (globs.length === 0) return false
  const positives = globs.filter((g) => !g.trim().startsWith('!'))
  const negatives = globs.filter((g) => g.trim().startsWith('!'))

  if (positives.length === 0) return false
  const matched = positives.some((g) => matchGlob(g, relPath))
  if (!matched) return false
  // For exclusion we need the raw pattern match (without the `!` flip).
  return !negatives.some((g) => matchGlob(g.trim().slice(1), relPath))
}
