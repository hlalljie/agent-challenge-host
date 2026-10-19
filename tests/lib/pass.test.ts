import { it, expect } from "vitest"
import { replyPasses } from "../../src/lib/pass"

it("passes only an exact ready reply", () => {
  expect(replyPasses("ready")).toBe(true)
  expect(replyPasses("  ready  ")).toBe(true)
  expect(replyPasses("Ready")).toBe(false)
  expect(replyPasses("ready now")).toBe(false)
})
