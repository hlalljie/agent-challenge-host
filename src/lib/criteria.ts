export type Criterion =
  | { id: string; type: "includes"; text: string }
  | { id: string; type: "excludes"; text: string }
  | { id: string; type: "maxLength"; unit: "words" | "characters"; max: number }
  | { id: string; type: "streak"; count: number }
  | { id: string; type: "repeat"; count: number; expected: string }
  | {
      id: string
      type: "verifier"
      title: string
      mode: "program" | "prompt"
      prompt: string
      expected?: string
    }

export type CriterionResult = {
  id: string
  label: string
  passed: boolean
  detail: string
}

export type CheckGroup = {
  id: string
  criteria: Criterion[]
}

export function criterionLabel(criterion: Criterion): string {
  switch (criterion.type) {
    case "includes":
      return `Includes “${criterion.text}”`
    case "excludes":
      return `Does not include “${criterion.text}”`
    case "maxLength":
      return `Under ${criterion.max} ${criterion.unit}`
    case "streak":
      return `Passes ${criterion.count} times in a row`
    case "repeat":
      return `Repeats ${criterion.count} times`
    case "verifier":
      return criterion.title
  }
}

export async function evaluateGroup(input: {
  instruction: string
  reply: string
  criteria: Criterion[]
  priorNonStreakPasses: boolean[]
  replies?: string[]
  basePassed?: boolean
  judge?: (prompt: string) => Promise<boolean>
}): Promise<{ results: CriterionResult[]; nonStreakPassed: boolean }> {
  const results: CriterionResult[] = []
  let nonStreakPassed = input.basePassed ?? true

  for (const criterion of input.criteria) {
    if (criterion.type === "streak") continue
    if (criterion.type === "repeat") {
      const replies = (input.replies ?? [input.reply]).slice(0, criterion.count)
      const matched = replies.filter((reply) => reply.trim() === criterion.expected).length
      const passed = replies.length === criterion.count && matched === criterion.count
      results.push({
        id: criterion.id,
        label: criterionLabel(criterion),
        passed,
        detail: `${matched} of ${criterion.count}`,
      })
      if (!passed) nonStreakPassed = false
      continue
    }
    const result = await evaluateOne(criterion, input)
    results.push(result)
    if (!result.passed) nonStreakPassed = false
  }

  for (const criterion of input.criteria) {
    if (criterion.type !== "streak") continue
    const streak = consecutivePasses(input.priorNonStreakPasses, nonStreakPassed)
    const passed = streak >= criterion.count
    results.push({
      id: criterion.id,
      label: criterionLabel(criterion),
      passed,
      detail: passed
        ? `${streak} in a row`
        : `${streak} of ${criterion.count} in a row`,
    })
  }

  return { results, nonStreakPassed }
}

export async function gradeGroups(input: {
  instruction: string
  reply: string
  replies?: string[]
  groups: CheckGroup[]
  history: Record<string, boolean[]>
  judge?: (prompt: string) => Promise<boolean>
}): Promise<{
  groups: { id: string; passed: boolean; criteria: CriterionResult[] }[]
  gates: Record<string, boolean>
}> {
  const judged: { id: string; passed: boolean; criteria: CriterionResult[] }[] = []
  const gates: Record<string, boolean> = {}
  let baseId: string | undefined
  let basePassed = true

  for (const group of input.groups) {
    const streakOnly = group.criteria.length > 0 && group.criteria.every((criterion) => criterion.type === "streak")
    const evaluated = await evaluateGroup({
      instruction: input.instruction,
      reply: input.reply,
      criteria: group.criteria,
      priorNonStreakPasses: input.history[streakOnly && baseId ? baseId : group.id] ?? [],
      replies: input.replies,
      basePassed: streakOnly ? basePassed : undefined,
      judge: input.judge,
    })
    const passed = evaluated.results.every((result) => result.passed)
    gates[group.id] = evaluated.nonStreakPassed
    judged.push({ id: group.id, passed, criteria: evaluated.results })
    if (Number(group.id) === 1) {
      baseId = group.id
      basePassed = evaluated.nonStreakPassed
    }
  }

  return { groups: judged, gates }
}

async function evaluateOne(
  criterion: Exclude<Criterion, { type: "streak" } | { type: "repeat" }>,
  input: {
    instruction: string
    reply: string
    judge?: (prompt: string) => Promise<boolean>
  },
): Promise<CriterionResult> {
  const label = criterionLabel(criterion)
  if (criterion.type === "includes") {
    const passed = input.instruction.toLowerCase().includes(criterion.text.toLowerCase())
    return { id: criterion.id, label, passed, detail: passed ? "Found" : "Missing" }
  }
  if (criterion.type === "excludes") {
    const passed = !input.instruction.toLowerCase().includes(criterion.text.toLowerCase())
    return { id: criterion.id, label, passed, detail: passed ? "Absent" : "Found" }
  }
  if (criterion.type === "maxLength") {
    const size =
      criterion.unit === "words"
        ? input.instruction.trim().split(/\s+/).filter(Boolean).length
        : input.instruction.length
    const passed = size < criterion.max
    return { id: criterion.id, label, passed, detail: `${size} ${criterion.unit}` }
  }
  if (criterion.mode === "program") {
    const passed = input.reply.trim() === (criterion.expected ?? "")
    return {
      id: criterion.id,
      label,
      passed,
      detail: passed ? "Matched" : "Did not match",
    }
  }
  if (!input.judge) {
    return { id: criterion.id, label, passed: false, detail: "No judge" }
  }
  const passed = await input.judge(criterion.prompt)
  return { id: criterion.id, label, passed, detail: passed ? "Passed" : "Failed" }
}

export function repeatCount(groups: CheckGroup[]): number {
  let count = 1
  for (const group of groups) {
    for (const criterion of group.criteria) {
      if (criterion.type === "repeat") count = Math.max(count, criterion.count)
    }
  }
  return count
}

function consecutivePasses(priorNewestFirst: boolean[], current: boolean): number {
  if (!current) return 0
  let count = 1
  for (const passed of priorNewestFirst) {
    if (!passed) break
    count += 1
  }
  return count
}
