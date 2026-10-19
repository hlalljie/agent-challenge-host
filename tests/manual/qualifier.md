# Qualifier pass, fail, and lesson

**Checklist ID:** `challenge-host-qualifier-001`

## Start state (mandatory)

Incomplete = do not run steps.

- **App:** `RUNNER=stub pnpm dev`
- **URL:** `http://localhost:3000`
- **Agent:** server running; fresh navigate; read MCP browser tool schemas before browser_* calls

## Preconditions

- Dependencies are installed (`pnpm install`).
- Port 3000 is free. The stub grades locally and does not call Gemini or store an attempt.

## Vitest prerequisite (optional)

Run in terminal **before** browser — **not** part of the checklist steps.

```bash
pnpm exec vitest run tests/lib/runner.test.ts
```

## Procedure

1. Open `http://localhost:3000` before running an attempt. Confirm the Lesson heading is visible, and its note says "Read this if the qualifier does not pass."
2. Type `hello` into Your instruction and run the attempt. Confirm the result says "Not yet.", the reply is not `ready`, and a "Read the lesson" link points at `#lesson`.
3. Replace the instruction with `Reply with exactly ready and nothing else.` and run the attempt again. Confirm the result says "You can skip the lesson.", the reply is `ready`, and the lesson note says "You passed, so you can skip this."

## Pass criteria

- The lesson is visible before any attempt.
- A loose instruction fails and links to the lesson.
- An instruction that demands exactly `ready` and nothing else passes, and the lesson says they can skip it.

## Fail criteria

- The lesson is missing on a fresh load.
- `hello` passes, or the fail result has no link to the lesson.
- The exact instruction fails, or the lesson still tells them to read it after a pass.

## Related

- `tests/lib/runner.test.ts`
