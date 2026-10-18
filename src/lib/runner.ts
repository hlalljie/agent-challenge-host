import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager"

export type StubRun = {
  reply: string
  passed: boolean
}

let cachedSecret: { id: string; value: string } | undefined

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

/**
 * One qualifier run.
 * Grades locally when `RUNNER=stub`. Otherwise calls Gemini Flash-Lite.
 * A missing key or a failed call is a fail and does not use the stub.
 * Local runs read `GEMINI_API_KEY`. The Lambda reads Secrets Manager.
 */
export async function runAttempt(
  instruction: string,
): Promise<{ reply: string; passed: boolean }> {
  if (process.env.RUNNER === "stub") {
    return runStub(instruction)
  }

  const key = await geminiKey()
  if (!key) {
    return failedAttempt()
  }

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash-lite",
        // Gemini 3 cannot turn thinking off. The lowest level keeps it from
        // reasoning its way into a perfect reply.
        reasoning_effort: "minimal",
        messages: [{ role: "user", content: instruction }],
      }),
      signal: AbortSignal.timeout(25000),
    })

    if (!response.ok) {
      return failedAttempt()
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[]
    }
    const content = payload.choices?.[0]?.message?.content
    if (typeof content !== "string") {
      return failedAttempt()
    }

    const reply = content.trim()
    return { reply, passed: reply === "ready" }
  } catch {
    return failedAttempt()
  }
}

async function geminiKey(): Promise<string | undefined> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY

  const secretId = process.env.GEMINI_SECRET_ID
  if (!secretId) return undefined
  if (cachedSecret?.id === secretId) return cachedSecret.value

  const client = new SecretsManagerClient({})
  const result = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  )
  if (!result.SecretString) return undefined
  cachedSecret = { id: secretId, value: result.SecretString }
  return result.SecretString
}

function failedAttempt(): { reply: string; passed: boolean } {
  return { reply: "The model call failed.", passed: false }
}

/**
 * Local stand-in for one model run.
 * Grades the instruction itself so pass and fail work without a network call.
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
