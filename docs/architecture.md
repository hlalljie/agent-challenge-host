# Architecture

How the system works now. Current state only; the reasons for choices are in [decisions](decisions.md).

## Overview

A Next.js qualifier on CloudFront, with the lesson on the same page. The visitor writes a single instruction. The server Lambda calls Gemini Flash-Lite unless `RUNNER=stub`, which grades the instruction locally. A pass says they can skip the lesson. A fail points them at the lesson. Static files and the render cache are on S3. Deploy steps are in [deploy](runbooks/deploy.md).

## Parts

- **Qualifier page** — owns the challenge, the form, and the lesson. It must not call a model or hold a secret. See [folder structure](folder-structure.md).
- **Runner** — owns one run and the pass rule. It calls Gemini Flash-Lite unless `RUNNER=stub`. Locally the key is `GEMINI_API_KEY`. On the Lambda the key is read from Secrets Manager. A missing key or a failed call is a fail, and the stub does not run in its place.
- **CloudFront** — the public site, on CloudFront's own hostname.
- **Server Lambda** — the Next.js server, including the qualifier.
- **S3** — static files and the render cache. The cache is not public.

## Flows

### Attempt

1. The qualifier page submits the instruction to the server action.
2. An empty instruction returns immediately and asks for text.
3. Otherwise the runner returns a reply plus pass or fail. A trimmed reply of exactly `ready` passes. If the Gemini call fails, the attempt fails.
4. Pass tells the visitor they can skip the lesson. Fail shows the reply and points at the lesson on the same page.

## Constraints

- The browser never receives a model key. Local runs use `GEMINI_API_KEY`. The Lambda reads it from Secrets Manager.
- One instruction, one reply. The runner does not keep a session.
- Attempts are not stored. A refresh clears the result.
- `RUNNER=stub` does not reach the network.
- The server and image function URLs are public. The address to share is the CloudFront hostname.
- The qualifier model is `gemini-3.5-flash-lite`. A hosted attempt reads the key from Secrets Manager.
