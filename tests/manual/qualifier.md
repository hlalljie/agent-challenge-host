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

1. Open `http://localhost:3000` before running an attempt. Confirm the left side lists Challenge 1: Say Ready in a Single Shot Prompt, Lesson 1 Exact Reply, Lesson 2 Nothing Else, and Lesson 3 Keep It Short.
2. Type `hello` into Your instruction and run the attempt. Confirm 1 star stays unfilled and the reply is not `ready`.
3. Open Lesson 1 Exact Reply, replace the instruction with `Reply with exactly ready and nothing else.`, and run the attempt. Confirm the Reply is only ready check says Pass and the reply is `ready`.

## Pass criteria

- The lessons are listed before any attempt.
- A loose instruction does not earn a star.
- An instruction that demands exactly `ready` passes the exact-reply lesson.

## Fail criteria

- The lessons are missing on a fresh load.
- `hello` earns a star.
- The exact instruction fails the Reply is only ready check.

## Related

- `tests/lib/runner.test.ts`
