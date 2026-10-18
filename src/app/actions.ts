"use server"

import { runAttempt } from "@/lib/runner"

export type AttemptState = {
  outcome: "pass" | "fail" | "empty"
  reply: string
}

export async function runQualifier(
  _previous: AttemptState | null,
  formData: FormData,
): Promise<AttemptState> {
  const instruction = String(formData.get("instruction") ?? "").trim()
  if (!instruction) {
    return { outcome: "empty", reply: "" }
  }

  const run = await runAttempt(instruction)
  return {
    outcome: run.passed ? "pass" : "fail",
    reply: run.reply,
  }
}
