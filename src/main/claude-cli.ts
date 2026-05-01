import { exec } from 'child_process'
import { promisify } from 'util'
import {
  parseMcpListOutput,
  type ClaudeCli,
  type ClaudeCliMcpServer,
} from '../core/claude-cli'

const execAsync = promisify(exec)

/**
 * Real `ClaudeCli` impl. Shells out via the user's login shell so PATH
 * wrappers/aliases that resolve `claude` (e.g. the desktop app's bundled
 * launcher) work the same way as in the user's terminal.
 */
export const nodeClaudeCli: ClaudeCli = {
  async listMcpServers(projectPath: string): Promise<ClaudeCliMcpServer[] | null> {
    try {
      const { stdout } = await execAsync('claude mcp list', {
        cwd: projectPath,
        shell: process.env.SHELL || '/bin/sh',
        timeout: 5000,
        env: { ...process.env, NO_COLOR: '1' },
      })
      const parsed = parseMcpListOutput(stdout)
      // Empty parse on non-empty stdout = format we don't recognize. Caller
      // should fall back rather than show "no MCPs" misleadingly.
      if (parsed.length === 0 && stdout.trim().length > 0) return null
      return parsed
    } catch {
      return null
    }
  },
}
