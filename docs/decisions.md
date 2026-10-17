# Decisions

## Stack

- **Next.js, TypeScript, and shadcn** — the stack the owner asked for. (challenge-host/D1)
- **pnpm and a `src/` directory** — the shadcn Next.js guide uses pnpm, and the folder doc is written around `src/`. (challenge-host/D2)

## Hosting

- **OpenNext on Lambda and CloudFront, via TerraNext** — current Next.js, and cheap while idle. The model call is a separate invoke because the web function times out at 30 seconds. (challenge-host/D3)

## Challenges

- **Stub the runner until an OpenCode key exists** — the app has to work before anyone signs in. (challenge-host/D4)
- **One sample qualifier first** — the real prompt is not chosen yet. (challenge-host/D5)
