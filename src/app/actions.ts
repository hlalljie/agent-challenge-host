"use server"

import { cookies, headers } from "next/headers"
import { runTrackedAttempt } from "@/lib/attempt"
import { viewerIp } from "@/lib/viewer-ip"

const sessionCookie = "attempt_session"

export type AttemptState = {
  outcome: "pass" | "fail" | "empty"
  reply: string
}

export async function runQualifier(
  _previous: AttemptState | null,
  formData: FormData,
): Promise<AttemptState> {
  const instruction = String(formData.get("instruction") ?? "").trim()
  if (!instruction) {
    return { outcome: "empty", reply: "" }
  }

  const jar = await cookies()
  let sessionId = jar.get(sessionCookie)?.value
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    jar.set(sessionCookie, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    })
  }

  const headerList = await headers()
  const ip = viewerIp(
    headerList.get("x-viewer-ip") ??
      headerList.get("cloudfront-viewer-address") ??
      headerList.get("x-forwarded-for"),
  )
  const run = await runTrackedAttempt({ instruction, sessionId, ip })
  return {
    outcome: run.passed ? "pass" : "fail",
    reply: run.reply,
  }
}
