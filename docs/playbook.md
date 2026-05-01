# Playbook

## The gap

A developer opening Claude Code for the first time — or the hundredth — often doesn't know what they don't know. The field around AI-assisted coding is moving fast: new conventions (AGENTS.md), new frameworks (spec-driven development), new tools, new posts on what "good" looks like. Most of it never reaches the people who would benefit, because there is no obvious place to look.

The Context Manager already shows users *what context their repo has*. The Playbook is the companion surface: *what context their repo could have*, and how to get there.

## What it is

A browseable, community-editable list of things a developer can adopt to make Claude work better with their repo. Each entry is something concrete — a convention to add, a tool to install, a practice to try — not an opinion piece.

Two categories:

- **Approaches** — conventions, frameworks, patterns, and reference reading. Things you adopt by changing how you work or what lives in the repo.
- **Tools** — installable software that plugs into the Claude Code workflow.

Reading material (e.g. Anthropic's best-practices posts, write-ups on context engineering) lives under Approaches: the link *is* the way to adopt it. A user can skim, and if it resonates, ask Claude Code to apply ideas from it to their repo.

## Examples

To make the shape concrete, entries we'd expect on day one:

**Approaches**
- AGENTS.md — emerging cross-tool convention for agent instructions
- Spec-driven development (GitHub spec-kit, Amazon Kiro)
- 12-factor agents (HumanLayer) — context window as managed resource
- Architecture Decision Records (ADRs)
- "State of the world" docs — durable external facts (regulations, customers, infra) that shape the code
- Cline's Memory Bank, Aider's CONVENTIONS.md, Cursor rules
- Anthropic's Claude Code best practices and effective context engineering posts

**Tools**
- Claude Context Manager itself
- MCP servers relevant to context (filesystem, search, etc.)

## Aim for the user

A developer or vibe coder lands on the Playbook and, in a few minutes, walks away with:

- A sense of what others are doing to make Claude effective on their repos
- One or two concrete things to try, with a clear path to adopt
- The ability to hand a Playbook entry to Claude Code and say "see if this applies here"

The Playbook is not a tutorial and not a curated best-of. It is a discovery surface for a fast-changing field, kept honest by community input and by usage signal the Context Manager can already see.

## Why community-editable

The space is young. Anything we ship as a fixed list will be wrong within a quarter. The Playbook is designed to be added to, sorted by popularity and adoption, and pruned over time — with the software providing the surface, not the opinions.

## Where the data lives

The Playbook is a separate repo: [`claude-context-playbook`](../../claude-context-playbook). Each entry is a small YAML file under `entries/approaches/` or `entries/tools/`, validated against `schema/entry.schema.json`. Submissions are PRs against that repo.

## Data source resolution

The desktop app resolves Playbook data in this order, using the first that succeeds:

1. **Local checkout.** If a sibling `claude-context-playbook/` directory exists (or a path the user has configured), read `entries/**/*.yml` directly and parse them against the schema. This is the supported path for local development and for contributors who want to preview unmerged entries.
2. **Cached `playbook.json`.** A previously-fetched copy on disk, used when offline.
3. **Remote `playbook.json`.** Fetched from the Playbook repo's published location (TODO: pin the URL once GitHub Pages or Releases is wired up).

Reading raw entries locally and reading a compiled `playbook.json` produce the same in-memory shape — the schema is the contract, not the JSON file. The compile step is for transport, not for semantics.

This is a first-class path, not a debug hack. A contributor editing an entry in the Playbook repo should see their change reflected in the desktop app on the next refresh, with no fetch and no rebuild.

See [vision.md](vision.md) for how the Playbook fits alongside the Context Manager.
