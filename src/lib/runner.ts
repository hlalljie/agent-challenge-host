export type StubRun = {
  reply: string
  passed: boolean
}

/**
 * Local stand-in for one OpenCode run.
 * Grades the instruction itself so the pass and fail screens work before a model key exists.
 */
export async function runStub(instruction: string): Promise<StubRun> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  const reply = replyFor(instruction)
  return { reply, passed: reply === "ready" }
}

function replyFor(instruction: string): string {
  const text = instruction.toLowerCase()
  const namesReady = /\bready\b/.test(text)
  const asksForNothingElse =
    text.includes("exactly") ||
    text.includes("only") ||
    text.includes("nothing else")

  if (namesReady && asksForNothingElse) return "ready"
  if (namesReady) return "Sure, I am ready to help."
  return "I can help with that. What would you like to do?"
}
