import { SFNClient, StartSyncExecutionCommand } from "@aws-sdk/client-sfn"
import { groupsFor, starsFrom } from "./challenge"
import { gradeGroups, repeatCount, type CheckGroup, type CriterionResult } from "./criteria"
import { runAttempt } from "./runner"

const localHistory = new Map<string, boolean[]>()

export type GroupResult = {
  id: string
  passed: boolean
  criteria: CriterionResult[]
}

export type TrackedResult = {
  reply: string
  passed: boolean
  stars: number
  groups: GroupResult[]
}

export async function runTrackedAttempt(input: {
  instruction: string
  sessionId: string
  ip: string
  targetId: string
}): Promise<TrackedResult> {
  const groups = groupsFor(input.targetId)
  const arn = process.env.ATTEMPT_STATE_MACHINE_ARN
  if (!arn || process.env.RUNNER === "stub") {
    return gradeLocally(input, groups)
  }

  const client = new SFNClient({})
  const started = await client.send(
    new StartSyncExecutionCommand({
      stateMachineArn: arn,
      input: JSON.stringify({
        sessionId: input.sessionId,
        ip: input.ip,
        instruction: input.instruction,
        targetId: input.targetId,
        groups: JSON.stringify(groups),
        attemptId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }),
    }),
  )
  if (started.status !== "SUCCEEDED" || !started.output) {
    return { reply: "The model call failed.", passed: false, stars: 0, groups: [] }
  }

  const output = JSON.parse(started.output) as {
    reply?: unknown
    passed?: unknown
    stars?: unknown
    groups?: GroupResult[]
  }
  return {
    reply: typeof output.reply === "string" ? output.reply : "The model call failed.",
    passed: output.passed === true,
    stars: typeof output.stars === "number" ? output.stars : 0,
    groups: Array.isArray(output.groups) ? output.groups : [],
  }
}

async function gradeLocally(
  input: { instruction: string; sessionId: string; targetId: string },
  groups: CheckGroup[],
): Promise<TrackedResult> {
  const runs = await Promise.all(
    Array.from({ length: repeatCount(groups) }, () => runAttempt(input.instruction)),
  )
  const replies = runs.map((run) => run.reply)
  const history: Record<string, boolean[]> = {}
  for (const group of groups) {
    history[group.id] = localHistory.get(`${input.sessionId}:${input.targetId}:${group.id}`) ?? []
  }
  const graded = await gradeGroups({
    instruction: input.instruction,
    reply: replies[0] ?? "",
    replies,
    groups,
    history,
  })
  for (const [id, passed] of Object.entries(graded.gates)) {
    const key = `${input.sessionId}:${input.targetId}:${id}`
    localHistory.set(key, [passed, ...(history[id] ?? [])])
  }
  const judged: GroupResult[] = graded.groups
  const stars = starsFrom(judged)
  const lesson = groups.length === 1 && !Number.isInteger(Number(groups[0]?.id))
  return {
    reply: replies[0] ?? "",
    passed: lesson ? judged[0]?.passed === true : stars >= 1,
    stars,
    groups: judged,
  }
}
