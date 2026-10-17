# Folder structure

Paths from the repository root.

## `src/` — Application

- **`src/app/`** — Next.js App Router. The home page is the qualifier: `page.tsx`, the attempt form, and the server action.
- **`src/components/ui/`** — shadcn components (button, card, textarea).
- **`src/lib/`** — The challenge runner. `runner.ts` is the local stub.

## `docs/` — Documentation

- **`docs/folder-structure.md`** — this file: where things live, and the list of every doc.
- **`docs/architecture.md`** — how the qualifier works now.
- **`docs/decisions.md`** — index of decisions that should outlive a plan.

## Other top-level folders

- **`.cursor/`** — agent rules, skills, and the active plan.
- **`public/`** — static files from the Next.js template.
- **`AGENTS.md`** — Next.js guide for coding agents, generated with the app.
- **`README.md`** — what this project is and how to run it.

## Adding a challenge

The home page is the only challenge, and the reference for the next one.

1. `src/app/page.tsx` — the challenge copy
2. `src/app/attempt-form.tsx` — the form and the pass / fail result
3. `src/app/actions.ts` — the server action
4. `src/lib/runner.ts` — the run and the pass rule
