import { join } from 'path'
import {
  getProjectsDir,
  getProjectDataDir,
  getProjectFamilyBasePath,
  encodeProjectPath,
} from './path-utils'
import type { FsReader } from './fs'

/**
 * Every data dir belonging to this project's "family": the main checkout plus
 * any git-worktree checkouts. Claude Code stores worktree sessions under a
 * separate encoded dir keyed by the worktree cwd, so anything that answers
 * "what sessions/state does this project have" from the main path alone
 * silently misses the worktree sessions. Both session resolution and the
 * session list scan the family so the picker and the resolver agree.
 */
export async function familyDataDirs(
  fs: FsReader,
  projectPath: string,
): Promise<string[]> {
  const encodedBase = encodeProjectPath(getProjectFamilyBasePath(projectPath))
  const root = getProjectsDir()
  // Always include the literal dir for the passed path so resolution still
  // works when the projects root isn't listable.
  const dirs = new Set<string>([
    getProjectDataDir(projectPath),
    join(root, encodedBase),
  ])
  const names = await fs.readdir(root)
  if (names) {
    const worktreePrefix = `${encodedBase}--claude-worktrees-`
    for (const n of names) {
      if (n === encodedBase || n.startsWith(worktreePrefix)) {
        dirs.add(join(root, n))
      }
    }
  }
  return [...dirs]
}
