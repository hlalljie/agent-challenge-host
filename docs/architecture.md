# Architecture

How the system works now. Current state only; the reasons for choices are in [decisions](decisions.md).

## Overview

A Next.js qualifier on CloudFront. A module teaches one skill. The left side explains the open lesson. The right side is that lesson's challenge, or the module challenge. The visitor writes a single instruction. The server Lambda calls Gemini Flash-Lite unless `RUNNER=stub`, which grades the instruction locally. Static files and the render cache are on S3. Deploy steps are in [deploy](runbooks/deploy.md).

## Parts

- **Qualifier page** — owns the challenge, the form, and the lesson. It must not call a model or hold a secret. See [folder structure](folder-structure.md).
- **Runner** — owns one run and the pass rule. It calls Gemini Flash-Lite unless `RUNNER=stub`. Locally the key is `GEMINI_API_KEY`. On the Lambda the key is read from Secrets Manager. A missing key is a fail. A failed call is tried twice more before that fail is returned, and the stub does not run in its place.
- **CloudFront** — the public site, on CloudFront's own hostname.
- **Server Lambda** — `challenge-host`. The Next.js server. The qualifier's server action, including the Gemini call, runs here.
- **Image Lambda** — `challenge-host-image`. Serves `/_next/image` only. It does not run the qualifier.
- **Revalidation Lambda** — `challenge-host-revalidation`. OpenNext uses it to refresh a cached page from a queue. It does not run the qualifier.
- **S3** — static files and the render cache. The cache is not public. Terraform state is a separate bucket.

## Flows

### Attempt

1. The qualifier page submits the instruction to the server action.
2. An empty instruction returns immediately and asks for text.
3. On a live run the server starts a Step Function and waits. The workflow stores the submission, calls Gemini, and checks the criteria for the open challenge. A local run calls Gemini once per repeat and shows each reply as that call finishes. A stub run grades on the machine and stores nothing.
4. Stars belong to the module challenge. A lesson's challenge tests that lesson and has no stars. A refresh clears the result on the page. The live row stays in DynamoDB.

## Constraints

- The browser never receives a model key. Local runs use `GEMINI_API_KEY`. The Lambda reads it from Secrets Manager.
- One instruction, one reply. The runner does not keep a model session. Each submission is its own attempt, with a new session id, and is not graded from earlier tries.
- A live attempt is stored. A stub attempt is not. A refresh clears the result on the page.
- `RUNNER=stub` does not reach the network.
- The server and image function URLs are public. The address to share is the CloudFront hostname.
- The qualifier model is `gemini-3.5-flash-lite`. A hosted attempt reads the key from Secrets Manager.
