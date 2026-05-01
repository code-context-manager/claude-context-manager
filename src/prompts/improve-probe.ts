/**
 * Prompt copied from the Probe page's "Improve" button.
 *
 * Asks Claude to review the static context that would load for a specific
 * file, flag gaps, and ask the user a small number of context-shaping
 * questions before proposing changes.
 */
export function buildImproveProbePrompt(
  projectPath: string | null,
  targetPath: string | null,
): string {
  const root = projectPath ?? '<project root>'
  const target = targetPath ?? '<target file>'
  return `Review the static context that loads when Claude works on ${target} in the project at ${root}.

Call the claude-context-manager MCP \`probe_file\` tool with these paths to get the authoritative answer (certain vs conditional load, per-entry token cost, trigger reason). Then compare against the full context available in the repo (docs/, .claude/, folder CLAUDE.mds) and check that relevant context loads. If it doesn't, suggest how to link context across the repo so the right context loads efficiently.`

}
