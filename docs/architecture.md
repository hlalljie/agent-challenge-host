# Architecture

How the system works now. Current state only; the reasons for choices are in [decisions](decisions.md).

## Overview

A local Next.js app with one qualifying challenge. The visitor writes a single instruction, the server runs a stub, and the page either says they can skip the lesson or shows a short walkthrough. Nothing is deployed, and no model is called.

## Parts

- **Qualifier page** — owns the challenge copy and the form. It must not call a model or hold a secret. See [folder structure](folder-structure.md).
- **Runner** — owns one run and the pass rule. The stub grades the instruction locally. It must not reach the network.

## Flows

### Attempt

1. The qualifier page submits the instruction to the server action.
2. An empty instruction returns immediately and asks for text.
3. Otherwise the runner waits briefly and returns a reply plus pass or fail.
4. Pass tells the visitor they can skip the lesson. Fail shows the reply and a three-step walkthrough.

## Constraints

- The browser never receives a model key. There is no key in this build.
- One instruction, one reply. The stub does not keep a session.
- Attempts are not stored. A refresh clears the result.
