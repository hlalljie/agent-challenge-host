import { gradeGroups, repeatCount, type CheckGroup } from "../lib/criteria"
import { starsFrom } from "../lib/challenge"
import { runAttempt } from "../lib/runner"

export async function handler(event: {
  instruction?: string
  sessionId?: string
  targetId?: string
  groups?: string
}) {
  const instruction = String(event.instruction ?? "")
  const groups = parseGroups(event.groups)
  const runs = await Promise.all(
    Array.from({ length: repeatCount(groups) }, () => runAttempt(instruction)),
  )
  const replies = runs.map((run) => run.reply)
  const graded = await gradeGroups({
    instruction,
    reply: replies[0] ?? "",
    replies,
    groups,
    history: {},
    judge: async (prompt) => {
      const verdict = await runAttempt(
        `${prompt}\n\nInstruction:\n${instruction}\n\nReply:\n${replies[0] ?? ""}\n\nReply with exactly pass or fail.`,
      )
      return verdict.reply.trim().toLowerCase() === "pass"
    },
  })
  const judged = graded.groups
  const gates = graded.gates

  const stars = starsFrom(judged)
  const lesson = groups.length === 1 && !Number.isInteger(Number(groups[0]?.id))
  return {
    reply: replies[0] ?? "",
    replies,
    passed: lesson ? judged[0]?.passed === true : stars >= 1,
    stars,
    groups: judged,
    gatesJson: JSON.stringify(gates),
    starsText: String(stars),
  }
}

function parseGroups(raw: string | undefined): CheckGroup[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as CheckGroup[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
