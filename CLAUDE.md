# Claude Context Manager

## Premise

AI-assisted coding breaks down when Claude lacks context. The code is easy; the business knowledge, conventions, and past decisions are not. This tool makes the context Claude Code already consumes visible, auditable, and curatable.

See [docs/vision.md](docs/vision.md) for the full premise.

## Development model

Key context about the state of the world is recorded in [docs/state/facts.md](docs/state/facts.md) — who works on this, where it runs, who uses it. Read it at the start of a session, and keep it current: when you learn something new about the state of the world, update it in the same change. Ask if something is unclear.

Docs in this project record facts, not rules. Rules are inferred from facts at the point of use. If a rule keeps getting violated, the missing piece is usually a fact, not a stronger rule.
