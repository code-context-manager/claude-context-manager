import { join } from 'path'
import type { FsReader } from './fs'
import { getProjectRulesDir, getUserRulesDir } from './path-utils'

export interface RuleFileRef {
  /** Absolute path to the rule markdown file. */
  filePath: string
  /** 'project' for `<project>/.claude/rules/`, 'global' for `~/.claude/rules/`. */
  scope: 'project' | 'global'
}

/**
 * List rule files in a `.claude/rules/` directory. Claude Code discovers all
 * `.md` files *recursively*, so rules organised into subdirectories
 * (`rules/frontend/…`, `rules/backend/…`) are included too. Returns [] if the
 * directory doesn't exist.
 *
 * Shared by the Inventory scanner, the project/file static-load builders, and
 * the Probe so every surface agrees on what counts as a rule.
 */
export async function listRuleFiles(
  fs: FsReader,
  dir: string,
  scope: 'project' | 'global',
): Promise<RuleFileRef[]> {
  const entries = await fs.readdirWithTypes(dir)
  if (!entries) return []

  const out: RuleFileRef[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory) {
      out.push(...(await listRuleFiles(fs, full, scope)))
    } else if (entry.name.endsWith('.md')) {
      out.push({ filePath: full, scope })
    }
  }
  return out
}

/**
 * List every rule visible to a project: user-scope `~/.claude/rules/` first
 * (loaded before project rules per Claude Code's precedence), then the
 * project's own `.claude/rules/`.
 */
export async function listAllRulesForProject(
  fs: FsReader,
  projectPath: string,
): Promise<RuleFileRef[]> {
  const user = await listRuleFiles(fs, getUserRulesDir(), 'global')
  const project = await listRuleFiles(fs, getProjectRulesDir(projectPath), 'project')
  return [...user, ...project]
}
