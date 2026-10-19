import { expect, it } from "vitest"
import { evaluateGroup } from "../../src/lib/criteria"
import type { Criterion } from "../../src/lib/criteria"

const exact: Criterion = {
  id: "exact",
  type: "verifier",
  title: "Reply is only ready",
  mode: "program",
  prompt: "only ready",
  expected: "ready",
}

it("checks phrases in the instruction and a word limit", async () => {
  const evaluated = await evaluateGroup({
    instruction: "Reply ready",
    reply: "ready",
    criteria: [
      { id: "has", type: "includes", text: "ready" },
      { id: "lacks", type: "excludes", text: "please" },
      { id: "short", type: "maxLength", unit: "words", max: 4 },
    ],
    priorNonStreakPasses: [],
  })

  expect(evaluated.results.every((result) => result.passed)).toBe(true)
})

it("counts a streak from earlier passes", async () => {
  const evaluated = await evaluateGroup({
    instruction: "Reply with exactly ready",
    reply: "ready",
    criteria: [exact, { id: "streak", type: "streak", count: 3 }],
    priorNonStreakPasses: [true, true],
  })

  expect(evaluated.results.find((result) => result.id === "streak")?.passed).toBe(true)
})

it("breaks a streak when this try misses the other checks", async () => {
  const evaluated = await evaluateGroup({
    instruction: "hello",
    reply: "I can help",
    criteria: [exact, { id: "streak", type: "streak", count: 3 }],
    priorNonStreakPasses: [true, true],
  })

  expect(evaluated.results.find((result) => result.id === "streak")?.passed).toBe(false)
})

it("passes a repeat only when every run matches", async () => {
  const passed = await evaluateGroup({
    instruction: "Say ready",
    reply: "ready",
    replies: ["ready", "ready", "ready"],
    criteria: [{ id: "repeat", type: "repeat", count: 3, expected: "ready" }],
    priorNonStreakPasses: [],
  })
  const missed = await evaluateGroup({
    instruction: "Say ready",
    reply: "ready",
    replies: ["ready", "okay", "ready"],
    criteria: [{ id: "repeat", type: "repeat", count: 3, expected: "ready" }],
    priorNonStreakPasses: [],
  })

  expect(passed.results[0]?.passed).toBe(true)
  expect(missed.results[0]?.passed).toBe(false)
})

it("asks the prompt verifier and uses its answer", async () => {
  const evaluated = await evaluateGroup({
    instruction: "hello",
    reply: "ready",
    criteria: [
      {
        id: "judge",
        type: "verifier",
        title: "Polite",
        mode: "prompt",
        prompt: "Is the reply only ready?",
      },
    ],
    priorNonStreakPasses: [],
    judge: async () => true,
  })

  expect(evaluated.results[0]?.passed).toBe(true)
})
