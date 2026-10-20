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

it("passes a stub instruction that demands exactly hello world", async () => {
  vi.stubEnv("RUNNER", "stub")

  const result = await runAttempt("Reply with exactly hello world and nothing else.")

  expect(result).toEqual({ reply: "hello world", passed: true })
  expect(fetchMock).not.toHaveBeenCalled()
})

it("fails a loose stub instruction without calling fetch", async () => {
  vi.stubEnv("RUNNER", "stub")

  const result = await runAttempt("hello")

  expect(result.passed).toBe(false)
  expect(result.reply).not.toBe("hello world")
  expect(fetchMock).not.toHaveBeenCalled()
})

it("fails when the Gemini key is missing and does not call the model", async () => {
  const result = await runAttempt("Reply with exactly hello world and nothing else.")

  expect(result).toEqual({ reply: "The model call failed.", passed: false })
  expect(fetchMock).not.toHaveBeenCalled()
})

it("sends the instruction to Gemini Flash-Lite", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key")
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: "hello world" } }] }),
  })

  const result = await runAttempt("hello")

  expect(result).toEqual({ reply: "hello world", passed: true })
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

it("retries a failed Gemini call twice and then gives up", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key")
  fetchMock.mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ choices: [{ message: { content: "hello world" } }] }),
  })

  const result = await runAttempt("Reply with exactly hello world and nothing else.")

  expect(result).toEqual({ reply: "The model call failed.", passed: false })
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

it("uses a later Gemini call when an earlier one fails", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key")
  fetchMock
    .mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "hello world" } }] }),
    })

  const result = await runAttempt("hello")

  expect(result).toEqual({ reply: "hello world", passed: true })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("reads the Gemini key from Secrets Manager when the Lambda has no local key", async () => {
  vi.stubEnv("GEMINI_SECRET_ID", "arn:aws:secretsmanager:us-east-1:123:secret:gemini")
  sendSecret.mockResolvedValue({ SecretString: "secret-key" })
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: "hello world" } }] }),
  })

  const result = await runAttempt("hello")

  expect(result.passed).toBe(true)
  expect(sendSecret).toHaveBeenCalledOnce()
  const init = fetchMock.mock.calls[0][1] as RequestInit
  expect((init.headers as Record<string, string>).Authorization).toBe(
    "Bearer secret-key",
  )
})
