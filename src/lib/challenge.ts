import type { CheckGroup, Criterion } from "@/lib/criteria"

const exactHello: Criterion = {
  id: "exact-hello-world",
  type: "verifier",
  title: "Reply is only hello world",
  mode: "program",
  prompt: "The reply is hello world and nothing else.",
  expected: "hello world",
}

const namesHello: Criterion = {
  id: "names-hello-world",
  type: "includes",
  text: "hello world",
}

const shortInstruction: Criterion = {
  id: "short-instruction",
  type: "maxLength",
  unit: "words",
  max: 12,
}

const repeatHello: Criterion = {
  id: "repeat-hello-world",
  type: "repeat",
  count: 3,
  expected: "hello world",
}

export type StarLevel = {
  stars: number
  criteria: Criterion[]
}

export type Challenge = {
  id: string
  title: string
  summary: string
  criteria: Criterion[]
  stars?: StarLevel[]
}

export type Lesson = {
  number: number
  title: string
  summary: string
  body: string[]
  challenge: Challenge
}

export type Module = {
  number: number
  title: string
  description: string
  hint: string
  challenge: Challenge & {
    navTitle: string
    navDetail: string
    detail: string
    stars: StarLevel[]
  }
  lessons: Lesson[]
}

export const sampleModule: Module = {
  number: 1,
  title: "Single Shot Prompting",
  description:
    "A single shot prompt is a prompt without a conversation that accomplishes a task. Accomplishing tasks with a single shot is a great way to look at the fundamental skills behind prompt engineering. Creating a good single prompt comes down to including all the necessary context, making a precise ask, while leaving no ambiguity.",
  hint: "If you're feeling confident, try the challenge. Otherwise try out the subchallenges in each lesson to learn the building blocks.",
  challenge: {
    id: "hello-world",
    navTitle: "Challenge 1: Say Hello World in a Single Shot Prompt",
    navDetail: "Put everything together to complete the challenge",
    title: "Say hello world",
    summary: 'Prompt the agent to get a response that says "hello world" and nothing else.',
    detail:
      "To complete this challenge you will need to prompt the agent to get an exact reply while also being very concise in your own explanation.",
    criteria: [namesHello, exactHello, repeatHello, shortInstruction],
    stars: [
      { stars: 1, criteria: [namesHello] },
      { stars: 2, criteria: [exactHello] },
      { stars: 3, criteria: [repeatHello, shortInstruction] },
    ],
  },
  lessons: [
    {
      number: 1,
      title: "Exact Reply",
      summary: "The reply is only hello world.",
      body: [
        "A single shot is one instruction and one reply. There is no second turn.",
        "Name the exact reply. For this qualifier, that reply is hello world.",
      ],
      challenge: {
        id: "exact",
        title: "Say hello world",
        summary: "One instruction. The reply has to be only hello world.",
        criteria: [exactHello],
      },
    },
    {
      number: 2,
      title: "Nothing Else",
      summary: "An extra sentence still fails.",
      body: [
        "Say that the reply must include nothing else.",
        "If the agent adds a greeting or an offer to help, the check fails.",
      ],
      challenge: {
        id: "nothing-else",
        title: "Say hello world",
        summary: "One instruction. Ask for hello world, and say that the reply should add nothing else.",
        criteria: [exactHello],
      },
    },
    {
      number: 3,
      title: "Keep It Short",
      summary: "The instruction names hello world and stays under 12 words.",
      body: [
        "A shorter instruction is easier to repeat and harder to hide extra demands in.",
        "Name hello world, and keep the whole instruction under 12 words.",
      ],
      challenge: {
        id: "short",
        title: "Say hello world",
        summary: "One short instruction that names hello world.",
        criteria: [namesHello, shortInstruction],
      },
    },
  ],
}

export function challengeFor(targetId: string): Challenge | undefined {
  if (targetId === sampleModule.challenge.id) return sampleModule.challenge
  return sampleModule.lessons.find((lesson) => lesson.challenge.id === targetId)?.challenge
}

export function lessonFor(targetId: string): Lesson | undefined {
  return sampleModule.lessons.find((lesson) => lesson.challenge.id === targetId)
}

export function knownTarget(id: string): string {
  if (challengeFor(id)) return id
  return sampleModule.challenge.id
}

export function groupsFor(targetId: string): CheckGroup[] {
  if (targetId === sampleModule.challenge.id) {
    return sampleModule.challenge.stars.map((star) => ({
      id: String(star.stars),
      criteria: star.criteria,
    }))
  }
  const challenge = challengeFor(targetId)
  if (!challenge) return []
  return [{ id: challenge.id, criteria: challenge.criteria }]
}

export function starsFrom(groups: { id: string; passed: boolean }[]): number {
  const levels = groups
    .map((group) => ({ level: Number(group.id), passed: group.passed }))
    .filter((group) => Number.isInteger(group.level))
    .sort((a, b) => a.level - b.level)
  let earned = 0
  for (const group of levels) {
    if (!group.passed || group.level !== earned + 1) break
    earned = group.level
  }
  return earned
}
