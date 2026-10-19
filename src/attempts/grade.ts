import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb"
import { evaluateGroup, type CheckGroup } from "../lib/criteria"
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
  const run = await runAttempt(instruction)
  const groups = parseGroups(event.groups)
  const history = await priorGates(event.sessionId, event.targetId)
  const judged = []
  const gates: Record<string, boolean> = {}

  for (const group of groups) {
    const evaluated = await evaluateGroup({
      instruction,
      reply: run.reply,
      criteria: group.criteria,
      priorNonStreakPasses: history[group.id] ?? [],
      judge: async (prompt) => {
        const verdict = await runAttempt(
          `${prompt}\n\nInstruction:\n${instruction}\n\nReply:\n${run.reply}\n\nReply with exactly pass or fail.`,
        )
        return verdict.reply.trim().toLowerCase() === "pass"
      },
    })
    const passed = evaluated.results.every((result) => result.passed)
    gates[group.id] = evaluated.nonStreakPassed
    judged.push({ id: group.id, passed, criteria: evaluated.results })
  }

  const stars = starsFrom(judged)
  const lesson = groups.length === 1 && !Number.isInteger(Number(groups[0]?.id))
  return {
    reply: run.reply,
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
