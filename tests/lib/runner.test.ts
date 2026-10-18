import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { runAttempt } from "../../src/lib/runner"

const fetchMock = vi.fn()
const sendSecret = vi.fn()

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class SecretClient {
    send = sendSecret
  },
  GetSecretValueCommand: class GetSecret {},
}))

beforeEach(() => {
  vi.stubEnv("RUNNER", "")
  vi.stubEnv("GEMINI_API_KEY", "")
  vi.stubEnv("GEMINI_SECRET_ID", "")
  fetchMock.mockReset()
  sendSecret.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it("passes a stub instruction that demands exactly ready", async () => {
  vi.stubEnv("RUNNER", "stub")

  const result = await runAttempt("Reply with exactly ready and nothing else.")

  expect(result).toEqual({ reply: "ready", passed: true })
  expect(fetchMock).not.toHaveBeenCalled()
})

it("fails a loose stub instruction without calling fetch", async () => {
  vi.stubEnv("RUNNER", "stub")

  const result = await runAttempt("hello")

  expect(result.passed).toBe(false)
  expect(result.reply).not.toBe("ready")
  expect(fetchMock).not.toHaveBeenCalled()
})

it("fails when the Gemini key is missing and does not call the model", async () => {
  const result = await runAttempt("Reply with exactly ready and nothing else.")

  expect(result).toEqual({ reply: "The model call failed.", passed: false })
  expect(fetchMock).not.toHaveBeenCalled()
})

it("sends the instruction to Gemini Flash-Lite", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key")
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: "ready" } }] }),
  })

  const result = await runAttempt("hello")

  expect(result).toEqual({ reply: "ready", passed: true })
  expect(fetchMock).toHaveBeenCalledOnce()
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(url).toBe(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  )
  expect((init.headers as Record<string, string>).Authorization).toBe(
    "Bearer test-key",
  )
  expect(JSON.parse(String(init.body))).toEqual({
    model: "gemini-3.5-flash-lite",
    reasoning_effort: "minimal",
    messages: [{ role: "user", content: "hello" }],
  })
})

it("fails when Gemini returns HTTP 500 and does not use the stub", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key")
  fetchMock.mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ choices: [{ message: { content: "ready" } }] }),
  })

  const result = await runAttempt("Reply with exactly ready and nothing else.")

  expect(result).toEqual({ reply: "The model call failed.", passed: false })
})

it("reads the Gemini key from Secrets Manager when the Lambda has no local key", async () => {
  vi.stubEnv("GEMINI_SECRET_ID", "arn:aws:secretsmanager:us-east-1:123:secret:gemini")
  sendSecret.mockResolvedValue({ SecretString: "secret-key" })
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: "ready" } }] }),
  })

  const result = await runAttempt("hello")

  expect(result.passed).toBe(true)
  expect(sendSecret).toHaveBeenCalledOnce()
  const init = fetchMock.mock.calls[0][1] as RequestInit
  expect((init.headers as Record<string, string>).Authorization).toBe(
    "Bearer secret-key",
  )
})
