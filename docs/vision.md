# Vision

## The gap

AI-assisted coding breaks down when Claude lacks context. The code is easy; the context isn't. A developer has years of accumulated business knowledge, team vocabulary, and architectural decisions — none of which reach the session unless they are explicitly configured. When context is missing, Claude guesses, and guesses are where mistakes come from.

Claude Code tries to close this gap with a scattered set of mechanisms: `CLAUDE.md` files at global / project / folder scope, path-scoped rules in `.claude/rules/`, lazy-loaded skills, auto-memory, MCP server configs, settings. Each solves part of the problem. Together, they are opaque. Developers cannot easily answer:

- What context is loaded right now for this project?
- How much of my token budget is it spending?
- Which file is shaping which decision?
- What am I missing that I should add?

## What this tool does

Claude Context Manager is a desktop app that makes the context Claude Code already consumes visible, auditable, and curatable. It is a passive reader over the user's filesystem — no runtime coupling with Claude Code, no modification of the user's configuration, no network dependencies.

## Success criteria

A developer opening this tool should be able to answer, in under a minute:

- Which context sources are loaded when I work in this project?
- Roughly how many tokens does each cost?
- Where does any given instruction originate — which file, which line?
- What am I missing that would help Claude make better decisions here?

If any of those answers takes longer than a minute, we have a product bug.

## How we present

The point of the UI is to give the user *understanding* of the context Claude Code has, not to surface raw configuration. Always summarize, structure, and curate. We never dump a multi-purpose config file (e.g. `~/.claude.json`, which mixes MCP entries with cached feature flags, project history, and other runtime state) into the UI in the hope the user spots the relevant slice — that is the inverse of what this tool exists to do.

Concretely:

- When an entry is one logical thing inside a larger file, the detail view shows a structured summary (name, scope, command, source file) and offers to open the file in the user's editor for the full picture.
- We read the file *for* the user. We do not show the file *as a substitute for* answering the question the user opened the entry to ask.
- When in doubt, prefer fewer fields presented clearly over more fields dumped raw.

This applies to every surface in the app. New views should be designed to answer a specific question the user has, not to mirror Claude Code's on-disk layout.

## Non-negotiables

- **Read-only.** The app never writes to Claude Code's configuration files or intercepts its runtime. A user can uninstall this app with no residue.
- **Context management only.** Not a billing dashboard, not a session replayer, not a token analytics product.
- **No private APIs.** We depend only on files Claude Code puts on disk by its documented behavior.

## Why this matters

If the thesis is right — that the context gap is the binding constraint on AI-assisted coding — then tools for managing context deserve the same care we give tools for managing code: source-controlled, reviewed, diffable, and decision-documented.

This project tries to be a working example of that thesis. Everything Claude needs to work effectively on this codebase is captured in this repo. The project *is* its own dogfood.

See also [playbook.md](playbook.md) for the companion surface: a community-editable list of approaches and tools users can adopt to give Claude better context in their own repos.
