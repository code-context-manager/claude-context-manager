import { join } from 'path'
import { getGlobalSkillsDir } from './path-utils'
import type { FsReader } from './fs'

export interface SkillEntry {
  /** Absolute path to the skill's markdown file. */
  filePath: string
  /** Skill folder/file name as a display fallback when frontmatter has no `name`. */
  displayName: string
  /** 'project' for `<project>/.claude/skills/`, 'global' for `~/.claude/skills/`. */
  scope: 'project' | 'global'
}

/**
 * List skill files in a skills directory. Recognises both supported layouts:
 *   - flat:   `<dir>/<name>.md`
 *   - packed: `<dir>/<name>/SKILL.md`
 *
 * Returns [] if the directory doesn't exist. Used by both the Inventory
 * scanner and the Probe so they agree on what counts as a skill.
 */
export async function listSkillFiles(
  fs: FsReader,
  dir: string,
  scope: 'project' | 'global',
): Promise<SkillEntry[]> {
  const entries = await fs.readdirWithTypes(dir)
  if (!entries) return []

  const out: SkillEntry[] = []
  for (const entry of entries) {
    if (!entry.isDirectory && entry.name.endsWith('.md')) {
      out.push({ filePath: join(dir, entry.name), displayName: entry.name, scope })
    } else if (entry.isDirectory) {
      const candidate = join(dir, entry.name, 'SKILL.md')
      if (await fs.readFile(candidate)) {
        out.push({ filePath: candidate, displayName: entry.name, scope })
      }
    }
  }
  return out
}

/**
 * List all skills visible to a project — its own `.claude/skills/` plus the
 * user's `~/.claude/skills/`. Project-scope first so callers that dedupe
 * by name keep the project override.
 */
export async function listAllSkillsForProject(
  fs: FsReader,
  projectPath: string,
): Promise<SkillEntry[]> {
  const project = await listSkillFiles(fs, join(projectPath, '.claude', 'skills'), 'project')
  const global = await listSkillFiles(fs, getGlobalSkillsDir(), 'global')
  return [...project, ...global]
}
