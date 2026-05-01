# claude-context-manager
Context driven development for claude code

## Using this in Claude Code

Clone and `pnpm install` — the postinstall step builds the bundled MCP server, and [`.mcp.json`](.mcp.json) registers it for the project. On your first Claude Code session in this repo you'll be prompted to approve the project-scoped server; once approved, tools like `get_project_static_load`, `probe_file`, and `get_active_session` are available.
