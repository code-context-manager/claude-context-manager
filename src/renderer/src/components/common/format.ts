/**
 * Compact token count: "1.2k" for ≥1000, raw number otherwise. Used in tight
 * spaces (tree row meta, scope/group headers). For roomier spots that show
 * the full count, use `n.toLocaleString()` directly.
 */
export function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}
