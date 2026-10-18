# Decisions

## Stack

- **Next.js, TypeScript, and shadcn** — the stack the owner asked for. (challenge-host/D1)
- **pnpm and a `src/` directory** — the shadcn Next.js guide uses pnpm, and the folder doc is written around `src/`. (challenge-host/D2)

## Hosting

- **OpenNext on Lambda and CloudFront, via TerraNext** — superseded by (challenge-host/D6).
- **OpenNext on Lambda, S3, and CloudFront's default domain** — no domain to buy. The Next server is a Lambda, static files are on S3, CloudFront serves its own hostname. (challenge-host/D6)
- **OpenCode Zen is the inference API** — the qualifier calls model `big-pickle` over HTTP. The OpenCode CLI is not the runner. (challenge-host/D7) — superseded by (aws-opencode-setup/D5)
- **Gemini Flash-Lite is the qualifier model** — `gemini-3.5-flash-lite` with the owner's API key. The small Flash model needs a precise instruction. (aws-opencode-setup/D5) — the local-key half is superseded by (aws-opencode-setup/D6)
- **The live Gemini key is in Secrets Manager** — the Lambda reads it there. The laptop `.env` is for local runs. (aws-opencode-setup/D6)

## Challenges

- **Stub the runner until an OpenCode key exists** — the app has to work before anyone signs in. (challenge-host/D4) — superseded by (aws-opencode-setup/D4)
- **`RUNNER=stub` is the local grader** — OpenCode is the default, and free models need no key. The stub is opt-in so a run without the network still grades. (aws-opencode-setup/D4) — the model half is superseded by (aws-opencode-setup/D5)
- **One sample qualifier first** — the real prompt is not chosen yet. (challenge-host/D5)
