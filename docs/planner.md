# Deterministic planner

`@dayos/planner` is a pure TypeScript package. It has no React, Next.js, Express, Clerk, Drizzle, or database dependency.

## Input and output

Inputs define the local plan date, IANA timezone, wake/sleep boundaries, normalized tasks, fixed events, semi-flexible protected windows, energy windows, life-area importance, and planner configuration. Output contains ordered non-overlapping time blocks, unscheduled tasks, and explainable warnings.

## Hard constraints

- Never schedule before wake time or after sleep time.
- Preserve fixed and locked commitments.
- Never overlap blocks.
- Place meals, exercise, and habit windows only inside their configured ranges.
- Keep completed and past work unchanged during rebalance.
- Keep a configurable end-of-day buffer rather than filling every minute.

## Scoring

Tasks are ranked transparently:

```ts
priority * 4
+ deadline urgency * 3
+ energy match * 2
+ preferred time match * 2
+ life area importance * 1.5
- context switch penalty * 1
```

Deadline urgency distinguishes overdue, due today, tomorrow, this week, later, and no-deadline work. Energy availability defaults to deep/high in the morning, high/medium in the afternoon, and medium/low in the evening; callers can override these windows.

## Scheduling

1. Convert the wake/sleep boundary from local time to absolute timestamps.
2. Reserve fixed events.
3. Place protected semi-flexible windows in their valid gaps.
4. Score pending tasks against each next gap.
5. Place unsplittable tasks only when a continuous gap fits.
6. Split allowed tasks into useful sessions without violating their minimum size.
7. Insert a recovery break after sustained focus, not after every small task.
8. Emit meaningful free-time blocks and preserve the configured buffer.
9. Return work that cannot fit instead of silently violating constraints.

## Rebalance

`rebalanceRemainingDay()` replaces the changed block with its authoritative timestamps, freezes completed/past/fixed/locked blocks, and reflows only future flexible items through remaining gaps. Overrun pushes eligible work forward around commitments; early completion can pull the next work into gained time. Items that no longer fit produce a `NO_CAPACITY` warning instead of being overlapped or dropped invisibly.

## Known limits

The MVP uses a greedy, score-ordered scheduler rather than global constraint optimization. It does not model travel time, multi-person availability, or calendar-provider recurrence rules. These can be added behind the same pure input/output contract without moving planner authority into the UI or an AI model.
