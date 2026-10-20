# Attempt separator

**Checklist ID:** `challenge-host-attempt-separator-001`

## Start state (mandatory)

Incomplete = do not run steps.

- **App:** `pnpm dev:stub` from the repo root
- **URL:** `http://localhost:3000/`
- **Agent:** server running; fresh navigate

## Preconditions

- The home challenge is open

## Procedure

1. Send several prompts, more than fit on one row.
2. Scroll the attempt names sideways.
3. Select the first attempt, then the last.

## Pass criteria

- The area below the attempts is a darker block with rounded top corners at both edges of the right panel.
- The selected attempt uses that same darker color and moves with the row when you scroll.
- There is no scrollbar and no page arrows.
- A finished attempt shows a green check.

## Fail criteria

- A line stays fixed while the selected attempt scrolls away from it.
- The first or last attempt turns into a square outline.
- A scrollbar is visible on the attempt row.

## Related

- `src/app/attempt-form.tsx`
