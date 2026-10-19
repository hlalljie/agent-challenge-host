import { expect, it } from "vitest"
import { viewerIp } from "../../src/lib/viewer-ip"

it("reads a CloudFront viewer address", () => {
  expect(viewerIp("203.0.113.8:443")).toBe("203.0.113.8")
  expect(viewerIp("[2001:db8::1]:443")).toBe("2001:db8::1")
})

it("uses the first forwarded address", () => {
  expect(viewerIp("198.51.100.4, 203.0.113.1")).toBe("198.51.100.4")
})

it("uses unknown when the header is missing", () => {
  expect(viewerIp(null)).toBe("unknown")
  expect(viewerIp("")).toBe("unknown")
})
