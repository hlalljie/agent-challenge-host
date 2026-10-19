# Folder structure

Paths from the repository root.

## `src/` — Application

- **`src/app/`** — Next.js App Router. The home page is the qualifier and its lesson: `page.tsx`, the attempt form, and the server action.
- **`src/components/ui/`** — shadcn components (button, card, textarea).
- **`src/lib/`** — The module, its lessons, and their challenges live in `challenge.ts`. `runner.ts` calls Gemini Flash-Lite, or grades locally when `RUNNER=stub`.

## `infra/` — Terraform

Terraform for the CloudFront site: S3, the server Lambda, the image and revalidation functions, and the tag table. `infra/publish.sh` builds the app and applies. State is in S3. Steps are in [deploy](runbooks/deploy.md).

## `tests/` — Tests

- **`tests/lib/`** — Vitest. `runner.test.ts` covers the runner.
- **`tests/manual/`** — Browser checklists. [README](../tests/manual/README.md) lists them. `qualifier.md` covers pass, fail, and the lesson.

## `docs/` — Documentation

- **`docs/folder-structure.md`** — this file: where things live, and the list of every doc.
- **`docs/architecture.md`** — how the qualifier works now.
- **`docs/decisions.md`** — index of decisions that should outlive a plan.
- **`docs/runbooks/deploy.md`** — build the app and publish it to CloudFront.

## Other top-level folders

- **`.cursor/`** — agent rules, skills, and the active plan.
- **`public/`** — static files from the Next.js template.
- **`.env.example`** — `GEMINI_API_KEY` and `RUNNER`. Real values stay in `.env`, which is ignored.
- **`AGENTS.md`** — Next.js guide for coding agents, generated with the app.
- **`README.md`** — what this project is and how to run it.

## Adding a module

The home page is the only module, and the reference for the next one. A module has lessons, and each lesson has one challenge. The module has one challenge of its own. That copy is in `src/lib/challenge.ts`. The page, the form, and the server action read it.
