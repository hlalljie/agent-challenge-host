import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { runTrackedAttempt } from "../../src/lib/attempt"

const send = vi.fn()

vi.mock("@aws-sdk/client-sfn", () => ({
  SFNClient: class StepFunctions {
    send = send
  },
  StartSyncExecutionCommand: class StartSync {},
}))

vi.mock("../../src/lib/runner", () => ({
  runAttempt: vi.fn(async () => ({ reply: "local", passed: false })),
}))

beforeEach(() => {
  vi.stubEnv("RUNNER", "")
  vi.stubEnv("ATTEMPT_STATE_MACHINE_ARN", "")
  send.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

it("grades locally when no workflow is configured", async () => {
  const result = await runTrackedAttempt({
    instruction: "hello",
    sessionId: "session",
    ip: "203.0.113.8",
    targetId: "missing",
  })

  expect(result).toEqual({ reply: "local", passed: false, stars: 0, groups: [] })
  expect(send).not.toHaveBeenCalled()
})

it("returns the workflow output", async () => {
  vi.stubEnv("ATTEMPT_STATE_MACHINE_ARN", "arn:aws:states:us-east-1:1:stateMachine:attempt")
  send.mockResolvedValue({
    status: "SUCCEEDED",
    output: JSON.stringify({ reply: "ready", passed: true }),
  })

  const result = await runTrackedAttempt({
    instruction: "hello",
    sessionId: "session",
    ip: "203.0.113.8",
    targetId: "missing",
  })

  expect(result).toEqual({ reply: "ready", passed: true, stars: 0, groups: [] })
  expect(send).toHaveBeenCalledOnce()
})

it("fails when the workflow does not succeed", async () => {
  vi.stubEnv("ATTEMPT_STATE_MACHINE_ARN", "arn:aws:states:us-east-1:1:stateMachine:attempt")
  send.mockResolvedValue({ status: "FAILED" })

  const result = await runTrackedAttempt({
    instruction: "hello",
    sessionId: "session",
    ip: "203.0.113.8",
    targetId: "missing",
  })

  expect(result).toEqual({
    reply: "The model call failed.",
    passed: false,
    stars: 0,
    groups: [],
  })
})
