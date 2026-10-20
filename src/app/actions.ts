"use server"

import { cookies, headers } from "next/headers"
import { gradeReplies, runTrackedAttempt, type GroupResult } from "@/lib/attempt"
import { runAttempt } from "@/lib/runner"
import { viewerIp } from "@/lib/viewer-ip"
import { knownTarget, sampleModule } from "@/lib/challenge"

const sessionCookie = "attempt_session"

export type AttemptState = {
  outcome: "pass" | "fail" | "empty"
  reply: string
  replies: string[]
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
    return { outcome: "empty", reply: "", replies: [], stars: 0, groups: [], targetId }
  }

  const jar = await cookies()
  const sessionId = crypto.randomUUID()
  jar.set(sessionCookie, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })

  const headerList = await headers()
  const ip = viewerIp(
    headerList.get("x-viewer-ip") ??
      headerList.get("cloudfront-viewer-address") ??
      headerList.get("x-forwarded-for"),
  )
  const run = await runTrackedAttempt({ instruction, sessionId, ip, targetId })
  return attemptState(run, targetId)
}

export async function attemptUsesWorkflow(): Promise<boolean> {
  return Boolean(process.env.ATTEMPT_STATE_MACHINE_ARN) && process.env.RUNNER !== "stub"
}

export async function runOneQualifier(instruction: string): Promise<{ reply: string }> {
  const run = await runAttempt(instruction)
  return { reply: run.reply }
}

export async function gradeQualifier(
  instruction: string,
  replies: string[],
  requestedTarget: string,
): Promise<AttemptState> {
  const targetId = knownTarget(requestedTarget)
  const run = await gradeReplies({ instruction, replies, targetId })
  return attemptState(run, targetId)
}

function attemptState(
  run: { passed: boolean; reply: string; replies: string[]; stars: number; groups: GroupResult[] },
  targetId: string,
): AttemptState {
  return {
    outcome: run.passed ? "pass" : "fail",
    reply: run.reply,
    replies: run.replies,
    stars: run.stars,
    groups: run.groups,
    targetId,
  }
}
