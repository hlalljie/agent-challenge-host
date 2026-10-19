import type { CheckGroup, Criterion } from "@/lib/criteria"

const exactReady: Criterion = {
  id: "exact-ready",
  type: "verifier",
  title: "Reply is only ready",
  mode: "program",
  prompt: "The reply is the word ready and nothing else.",
  expected: "ready",
}

const namesReady: Criterion = {
  id: "names-ready",
  type: "includes",
  text: "ready",
}

const shortInstruction: Criterion = {
  id: "short-instruction",
  type: "maxLength",
  unit: "words",
  max: 12,
}

const threeInARow: Criterion = {
  id: "three-in-a-row",
  type: "streak",
  count: 3,
}

export type Lesson = {
  id: string
  title: string
  rule: string
  body: string[]
  criteria: Criterion[]
}

export type StarLevel = {
  stars: number
  criteria: Criterion[]
}

export type ChallengeDefinition = {
  id: string
  title: string
  summary: string
  stars: StarLevel[]
  lessons: Lesson[]
}

export const sampleChallenge: ChallengeDefinition = {
  id: "ready",
  title: "Say ready",
  summary:
    "One instruction, one reply. The agent passes a star when every check for that star succeeds.",
  stars: [
    { stars: 1, criteria: [exactReady] },
    { stars: 2, criteria: [exactReady, threeInARow] },
    { stars: 3, criteria: [exactReady, threeInARow, namesReady, shortInstruction] },
  ],
  lessons: [
    {
      id: "exact",
      title: "Exact reply",
      rule: "The reply is only the word ready.",
      body: [
        "A single shot is one instruction and one reply. There is no second turn.",
        "Name the exact reply. For this qualifier, that reply is the word ready.",
      ],
      criteria: [exactReady],
    },
    {
      id: "nothing-else",
      title: "Nothing else",
      rule: "An extra sentence still fails.",
      body: [
        "Say that the reply must include nothing else.",
        "If the agent adds a greeting or an offer to help, the check fails.",
      ],
      criteria: [exactReady],
    },
    {
      id: "short",
      title: "Keep it short",
      rule: "The instruction names ready and stays under 12 words.",
      body: [
        "A shorter instruction is easier to repeat and harder to hide extra demands in.",
        "Name ready, and keep the whole instruction under 12 words.",
      ],
      criteria: [namesReady, shortInstruction],
    },
  ],
}

export function groupsFor(targetId: string): CheckGroup[] {
  if (targetId === sampleChallenge.id) {
    return sampleChallenge.stars.map((star) => ({
      id: String(star.stars),
      criteria: star.criteria,
    }))
  }
  const lesson = sampleChallenge.lessons.find((item) => item.id === targetId)
  if (!lesson) return []
  return [{ id: lesson.id, criteria: lesson.criteria }]
}

export function starsFrom(groups: { id: string; passed: boolean }[]): number {
  let earned = 0
  for (const group of groups) {
    const level = Number(group.id)
    if (!Number.isInteger(level)) continue
    if (group.passed && level > earned) earned = level
  }
  return earned
}
