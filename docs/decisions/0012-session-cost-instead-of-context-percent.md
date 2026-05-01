# 0012 — Show session cost, not context-window percent

> **Reversed 2026-05-01.** The dollar figure was wrong in practice — the
> pricing table drifted, and we under-counted 1h-cache and over-counted
> the 1M-tier Sonnet, so the headline number misled. The popover now shows
> only values we can read directly from the JSONL: per-category token
> counts and user/assistant message counts. `pricing.ts` and
> `LoadedContextSnapshot.totalCost` are removed.

## Problem

The session top bar currently shows `tokens used / 200,000` with a coloured
bar. Two things are wrong with that:

1. **The denominator is hardcoded** ([SessionTopBar.tsx:5](../../src/renderer/src/components/session/SessionTopBar.tsx#L5):
   `const CONTEXT_WINDOW = 200_000`). When a session runs with the 1M-token
   beta enabled (as Opus 4.7 sessions in Claude Code can), the meter still
   reads "/ 200.0k" — it's a lie about the headroom available.
2. **Even if we fixed the denominator, "% of window" is not what the user
   actually wants to know.** The window size is a ceiling, not a budget.
   What costs money — and what the user has direct control over — is the
   token volume itself, weighted by the model and by whether tokens hit the
   prompt cache. A 1M Opus session and a 1M Haiku session have radically
   different costs but identical "% of window".

We started down the path of reading the per-session model from the JSONL
(every assistant message carries `message.model`, e.g. `claude-opus-4-7`) so
we could pick the right window size. The model is there, but the **beta
flag that unlocks 1M context is not** recorded in the JSONL we can see —
it's a request-time header. So we'd still be guessing, just with one more
input.

## Decision

**Replace the context-window meter with a session-cost indicator.**

Cost is something we can compute exactly from data already in the JSONL:

- `message.model` on every assistant turn tells us which model produced it.
- `message.usage` on every assistant turn breaks tokens into the four
  categories Anthropic prices separately: `input_tokens`,
  `cache_creation_input_tokens`, `cache_read_input_tokens`,
  `output_tokens`.

We multiply each category by the per-model rate and sum across all
assistant turns in the session. This is a real dollar figure, not a
proxy.

### What the UI shows

A single dollar number next to the session selector, e.g. `$0.42`, with a
colour band:

- **green**: < $0.50 — cheap exploration
- **yellow**: $0.50–$2 — substantive work
- **red**: > $2 — expensive; worth asking whether to start fresh

Hover/title shows the breakdown: input, cache-write, cache-read, output
tokens and their dollar contributions, plus the model. Thresholds are a
starting guess and should move once we have a feel for typical sessions.

We **drop** the percent-of-window framing entirely. If we later want a
"running out of room" warning, we add it as a separate signal (e.g. red
border when `total tokens > 0.9 × known-window-for-model`), not as the
primary meter.

## Pricing source

We need a per-model price table. Anthropic publishes these on the pricing
page; the shape we care about is four numbers per model:

| Field             | Anthropic name                     |
| ----------------- | ---------------------------------- |
| `input`           | Input tokens                       |
| `cacheWrite`      | Prompt caching — write (5m or 1h)  |
| `cacheRead`       | Prompt caching — read              |
| `output`          | Output tokens                      |

All in dollars per million tokens.

**Open question — verify before encoding:** the exact numbers for Opus 4.7,
Sonnet 4.6, and Haiku 4.5, and whether Anthropic prices the 1h cache
differently from the 5m cache (the JSONL distinguishes
`ephemeral_5m_input_tokens` vs `ephemeral_1h_input_tokens` in
`usage.cache_creation`). Until verified by a human looking at the pricing
page, the price table lives in one file with a comment pointing at the
source URL and the date it was checked.

The 1M-context Sonnet tier is priced higher than the ≤200k tier; if we
ever support that, the price lookup needs to know the request was made
with the 1M beta — which, again, isn't in the JSONL. Acceptable for now:
assume the standard tier and document the under-count.

## Why not both (cost *and* window %)

Two numbers next to each other invites the user to ask "which one matters?"
The answer is almost always cost. Window-% only matters at the very edge
(>80%), and when it does, a separate warning treats it as the exception it
is rather than giving it equal billing every session.

## Implementation sketch

- New `src/core/pricing.ts` — pure data + a `costFor(model, usage)`
  function. Tested with a fixture per supported model.
- `loaded-context.ts` already extracts `lastUsage`, but cost needs the sum
  across all assistant turns plus per-turn model. Add `totalCost: number`
  and `model: string | null` (most-recent model seen) to
  `LoadedContextSnapshot`.
- `SessionTopBar.tsx` reads `totalCost`, picks a colour band, formats as
  `$X.XX`. Tooltip shows the breakdown.
- Remove `CONTEXT_WINDOW` constant.

## Open questions

- Exact current prices (see above).
- 5m vs 1h cache pricing.
- Threshold values for green/yellow/red — guess, then tune.
- Whether to show cumulative cost across *all* sessions in a project, not
  just the active one. Probably yes eventually, but out of scope for v1.
