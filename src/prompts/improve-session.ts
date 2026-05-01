/**
 * Prompt copied from the Session page's "Improve" button.
 *
 * Asks Claude to look at what loaded in the current session, flag gaps that
 * would have helped, and suggest improvements to the project's context setup.
 */
export function buildImproveSessionPrompt(projectPath: string | null): string {
  const root = projectPath ?? '<project root>'
  return `Use the claude-context-manager MCP server (\`get_active_session\` for the current session, \`get_project_static_load\` and \`list_sources\` for the full project) to compare what loaded in this session against what's available project-wide. Flag vital context that was missing from the session and suggest project-context improvements that would have prevented the gap. Also briefly scan the repo for docs that look like they hold vital context but aren't registered. If things look largely correct, don't suggest improvements.`
}
