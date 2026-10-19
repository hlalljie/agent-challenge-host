"use server"

import { cookies, headers } from "next/headers"
import { runTrackedAttempt, type GroupResult } from "@/lib/attempt"
import { viewerIp } from "@/lib/viewer-ip"
import { knownTarget, sampleModule } from "@/lib/challenge"

const sessionCookie = "attempt_session"

export type AttemptState = {
  outcome: "pass" | "fail" | "empty"
  reply: string
  stars: number
  groups: GroupResult[]
  targetId: string
}

export async function runQualifier(
  _previous: AttemptState | null,
  formData: FormData,
): Promise<AttemptState> {
  const instruction = String(formData.get("instruction") ?? "").trim()
  const requested = String(formData.get("target") ?? sampleModule.challenge.id)
  const targetId = knownTarget(requested)
  if (!instruction) {
    return { outcome: "empty", reply: "", stars: 0, groups: [], targetId }
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
  const run = await runTrackedAttempt({ instruction, sessionId, ip, targetId })
  return {
    outcome: run.passed ? "pass" : "fail",
    reply: run.reply,
    stars: run.stars,
    groups: run.groups,
    targetId,
  }
}
