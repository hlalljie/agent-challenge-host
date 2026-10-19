import { runAttempt } from "../lib/runner"

export async function handler(event: { instruction?: string }) {
  return runAttempt(String(event.instruction ?? ""))
}
