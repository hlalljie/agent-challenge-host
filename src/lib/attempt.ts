import { SFNClient, StartSyncExecutionCommand } from "@aws-sdk/client-sfn"
import { runAttempt } from "./runner"

export async function runTrackedAttempt(input: {
  instruction: string
  sessionId: string
  ip: string
}): Promise<{ reply: string; passed: boolean }> {
  const arn = process.env.ATTEMPT_STATE_MACHINE_ARN
  if (!arn || process.env.RUNNER === "stub") {
    return runAttempt(input.instruction)
  }

  const client = new SFNClient({})
  const started = await client.send(
    new StartSyncExecutionCommand({
      stateMachineArn: arn,
      input: JSON.stringify({
        sessionId: input.sessionId,
        ip: input.ip,
        instruction: input.instruction,
        attemptId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }),
    }),
  )
  if (started.status !== "SUCCEEDED" || !started.output) {
    return { reply: "The model call failed.", passed: false }
  }

  const output = JSON.parse(started.output) as {
    reply?: unknown
    passed?: unknown
  }
  return {
    reply:
      typeof output.reply === "string"
        ? output.reply
        : "The model call failed.",
    passed: output.passed === true,
  }
}
