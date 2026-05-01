/**
 * Token estimates for Claude Code internals that we can't read from disk.
 * See docs/scope.md for the source of these numbers — they are load-bearing
 * Probe nodes but have no parseable body, so we synthesize them.
 */
export const SYSTEM_PROMPT_TOKENS = 4200
export const ENV_INFO_TOKENS = 280

/**
 * Claude Code's MEMORY.md loading window. Content past this boundary is
 * listed but marked as overflow on the probe tree.
 */
export const MEMORY_MAX_LINES = 200
export const MEMORY_MAX_BYTES = 25 * 1024

/**
 * MCP tool *index* (descriptions only) token estimate per server. Full
 * schemas are conditional children — loaded when Claude invokes ToolSearch.
 */
export const MCP_INDEX_TOKENS = 120

/**
 * Past this many hooks on a probe tree, collapse the tail into a "+N more"
 * node. See docs/decisions/0007.
 */
export const HOOK_BRANCH_CAP = 8
