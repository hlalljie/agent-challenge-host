# Challenge host

A site for practicing prompts for an agent. A module teaches one skill. Each lesson explains one part of that skill and has a subchallenge that tests it. The module also has one challenge that puts the parts together. Stars on that challenge show how far the prompt has gotten.

![The Say ready challenge with the first star filled](docs/module-progress.png)

**Status:** in development

## Run it

```bash
pnpm install
pnpm dev
```

`pnpm dev` calls Gemini with `GEMINI_API_KEY` from `.env`. The live site reads that key from Secrets Manager. To grade locally without calling Gemini, run `pnpm dev:stub`.

Then open http://localhost:3000.

Publishing to CloudFront is in [docs/runbooks/deploy.md](docs/runbooks/deploy.md).

```bash
pnpm test
pnpm lint
pnpm build
```

## Docs

The map of the code and the docs is in [docs/folder-structure.md](docs/folder-structure.md).
