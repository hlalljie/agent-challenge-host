import { it, expect } from "vitest"
import { replyPasses } from "../../src/lib/pass"

it("passes only an exact hello world reply", () => {
  expect(replyPasses("hello world")).toBe(true)
  expect(replyPasses("  Hello World  ")).toBe(true)
  expect(replyPasses("hello")).toBe(false)
  expect(replyPasses("hello world now")).toBe(false)
})
