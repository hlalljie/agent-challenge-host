# Challenge host

A site for agent challenges. A module teaches one skill. Each lesson explains one part of that skill and has one challenge that tests it. The module also has one challenge that puts the parts together.

**Status:** in development

## Run it

```bash
pnpm install
pnpm dev
```

`pnpm dev` calls Gemini with `GEMINI_API_KEY` from `.env`. The live site reads that key from Secrets Manager. To grade locally without calling Gemini, start with `RUNNER=stub pnpm dev`.

Then open http://localhost:3000.

Publishing to CloudFront is in [docs/runbooks/deploy.md](docs/runbooks/deploy.md).

```bash
pnpm test
pnpm lint
pnpm build
```

## Docs

The map of the code and the docs is in [docs/folder-structure.md](docs/folder-structure.md).
