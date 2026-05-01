---
name: propose-product-direction
description: Use when discussing product strategy, user needs, or roadmap. Loads vision and current state — not implementation details.
trigger: User says things like "what should we build next", "users want", "roadmap", "product direction", "priorities", or is discussing strategy rather than implementation.
---

# Proposing product direction

## Context to load

1. [docs/vision.md](../../docs/vision.md) — the premise is the filter. *Does this proposal close the context gap?*
2. [docs/state/](../../docs/state/) — what stage the project is in, who uses it, what's already built. Strategy that ignores current state is wishful thinking.

You do **not** need implementation docs here. A product-level discussion that's already constraining itself by "how would we build it" is premature.

## While proposing

- Every proposal should connect to the premise in one sentence: *"this helps developers see what context Claude is using by …"*. If that sentence feels strained, the proposal probably belongs somewhere else.
- Offer **2–3 directions with tradeoffs**, not a single recommendation.
- Distinguish **what users will ask for** from **what actually serves the vision**. Adjacency is not alignment — session-replay UI is adjacent and tempting, but it doesn't close the context gap.
- Surface the no. Which obvious-looking options are you *not* recommending, and why? A product proposal without rejections is incomplete.

## What happens next

If the user agrees a direction, hand off to the `plan-feature` skill for the first concrete slice. Strategy and implementation planning are separate sessions' work — don't conflate them.
