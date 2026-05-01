/**
 * Prompt copied from the Playbook page's "Apply" button.
 *
 * Asks Claude to look at the catalog of playbook entries and recommend
 * which ones would most help the active project.
 */
export function buildImprovePlaybookPrompt(projectPath: string | null): string {
  const root = projectPath ?? '<project root>'
  return `Review the playbook (a catalog of approaches and tools that help Claude work better on a repo) and assess which entries would most help the project at ${root}. Discuss what inspiration can be drawn from these approaches to provide genuine high value improvements to this project`
}
