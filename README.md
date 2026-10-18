# Challenge host

A site for agent challenges. The first challenge is a single-shot qualifier: pass it and skip the lesson, or fail it and read a short walkthrough.

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
