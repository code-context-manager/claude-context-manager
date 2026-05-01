/**
 * Prompt copied from the Inventory page's "Improve" button.
 *
 * Asks Claude to use the claude-context-manager MCP to review the current
 * context setup, then ask the user a short, selective set of context-shaping
 * questions before proposing changes.
 */
export function buildImproveInventoryPrompt(projectPath: string | null): string {
  const root = projectPath ?? '<project root>'
  return `Review the context setup for the project at ${root}. Flag obvious gaps or improvements.

Start by calling the claude-context-manager MCP server to see what context is actually loaded: \`list_sources\` for the inventory and \`get_project_static_load\` for the always-on bundle (with token costs). Then look at docs/ and any state files in the repo that are NOT registered as context — those are the most likely gap.

Don't fill gaps with assumptions. Ask a small number of questions about what strongly shapes the code: product stage, who's working on it, business rules, infrastructure. Ask only about what seems like it strongly shapes the code.`
}
