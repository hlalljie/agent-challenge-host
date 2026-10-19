import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb"
import { gradeGroups, repeatCount, type CheckGroup } from "../lib/criteria"
import { starsFrom } from "../lib/challenge"
import { runAttempt } from "../lib/runner"

const dynamo = new DynamoDBClient({})

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
  const history = await priorGates(event.sessionId, event.targetId)
  const graded = await gradeGroups({
    instruction,
    reply: replies[0] ?? "",
    replies,
    groups,
    history,
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

async function priorGates(
  sessionId: string | undefined,
  targetId: string | undefined,
): Promise<Record<string, boolean[]>> {
  const table = process.env.ATTEMPTS_TABLE
  if (!table || !sessionId) return {}
  const result = await dynamo.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: { ":sessionId": { S: sessionId } },
      ScanIndexForward: false,
      Limit: 20,
    }),
  )
  const history: Record<string, boolean[]> = {}
  for (const item of result.Items ?? []) {
    if (item.targetId?.S !== targetId) continue
    if (item.status?.S !== "done") continue
    const gates = parseGates(item.gates?.S)
    for (const [id, passed] of Object.entries(gates)) {
      history[id] ??= []
      history[id].push(passed)
    }
  }
  return history
}

function parseGates(raw: string | undefined): Record<string, boolean> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}
