"use client"

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { attemptUsesWorkflow, gradeQualifier, runOneQualifier, runQualifier, type AttemptState } from "./actions"
import { groupsFor, lessonFor, sampleModule } from "@/lib/challenge"
import { criterionLabel, repeatCount } from "@/lib/criteria"

type AttemptRecord = {
  runId: number
  prompt: string
  replies: string[]
  pending: boolean[]
  stars?: number
  graded: AttemptState | null
}

export function Challenge() {
  const [instruction, setInstruction] = useState("")
  const [target, setTarget] = useState(sampleModule.challenge.id)
  const [sidebarRatio, setSidebarRatio] = useState(0.5)
  const [history, setHistory] = useState<Record<string, AttemptRecord[]>>({})
  const [cursor, setCursor] = useState<Record<string, number>>({})
  const [scores, setScores] = useState<Record<string, number>>({})
  const [running, setRunning] = useState(false)
  const generation = useRef(0)
  const thread = useRef<HTMLDivElement>(null)
  const attemptRow = useRef<HTMLDivElement>(null)
  const attempts = history[target] ?? []
  const cursorIndex = attempts.length === 0 ? 0 : Math.min(cursor[target] ?? attempts.length - 1, attempts.length - 1)
  const current = attempts[cursorIndex]
  const shown = current?.graded ?? null
  const lesson = lessonFor(target)
  const activeChallenge = lesson?.challenge ?? sampleModule.challenge

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight })
  }, [attempts.length, cursorIndex, running])

  useLayoutEffect(() => {
    const scroller = attemptRow.current
    if (!scroller) return
    const selected = scroller.querySelector<HTMLElement>('[data-selected="true"]')
    if (!selected) return
    // Attempt 1's top runs to the panel edge, so it has to stay pinned there.
    if (selected === scroller.querySelector("button")) {
      scroller.scrollLeft = 0
      return
    }
    // Keep the side curves on screen, and keep the end tabs clear of the panel corners.
    const gutter = 40
    const left = selected.offsetLeft
    const right = left + selected.offsetWidth
    const viewLeft = scroller.scrollLeft
    const viewRight = viewLeft + scroller.clientWidth
    if (left - gutter < viewLeft) scroller.scrollLeft = Math.max(0, left - gutter)
    else if (right + gutter > viewRight) scroller.scrollLeft = right + gutter - scroller.clientWidth
  }, [cursorIndex, attempts.length])

  useEffect(() => {
    const row = attemptRow.current
    if (!row) return
    const onWheel = (event: WheelEvent) => {
      if (row.scrollWidth <= row.clientWidth) return
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (delta === 0) return
      event.preventDefault()
      row.scrollLeft += delta
    }
    row.addEventListener("wheel", onWheel, { passive: false })
    return () => row.removeEventListener("wheel", onWheel)
  }, [attempts.length])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = instruction.trim()
    if (!text || running) return
    const field = event.currentTarget.elements.namedItem("instruction")
    if (field instanceof HTMLTextAreaElement) field.style.height = ""
    const targetId = target
    const count = repeatCount(groupsFor(targetId))
    const runId = generation.current + 1
    generation.current = runId
    const replies = Array.from({ length: count }, () => "")
    const slots = Array.from({ length: count }, () => true)
    setRunning(true)
    setInstruction("")
    setHistory((current) => {
      const list = current[targetId] ?? []
      return {
        ...current,
        [targetId]: [
          ...list,
          { runId, prompt: text, replies: replies.slice(), pending: slots.slice(), graded: null },
        ],
      }
    })
    setCursor((current) => ({ ...current, [targetId]: history[targetId]?.length ?? 0 }))

    let ticket = 0
    void (async () => {
      try {
        if (await attemptUsesWorkflow()) {
          if (generation.current !== runId) return
          const formData = new FormData()
          formData.set("instruction", text)
          formData.set("target", targetId)
          const graded = await runQualifier(null, formData)
          if (generation.current !== runId) return
          publish(graded, graded.replies.map(() => false))
          return
        }

        await Promise.all(
          replies.map(async (_, index) => {
            const result = await runOneQualifier(text)
            if (generation.current !== runId) return
            replies[index] = result.reply
            slots[index] = false
            const mine = ++ticket
            const graded = await gradeQualifier(text, replies.slice(), targetId)
            if (generation.current !== runId || mine !== ticket) return
            publish(graded, slots.slice())
          }),
        )
      } finally {
        if (generation.current === runId) setRunning(false)
      }
    })()

    function publish(graded: AttemptState, pending: boolean[]) {
      const stars = targetId === sampleModule.challenge.id ? graded.stars : undefined
      setScores((current) => ({ ...current, [targetId]: progressRatio(graded) }))
      setHistory((current) => {
        const list = current[targetId] ?? []
        return {
          ...current,
          [targetId]: list.map((item) =>
            item.runId === runId ? { ...item, replies: graded.replies, pending, stars, graded } : item,
          ),
        }
      })
    }
  }

  return (
    <>
      <aside
        className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-border bg-sidebar lg:w-[calc((100%-0.75rem)*var(--pane))] lg:border-r lg:border-b-0"
        style={{ "--pane": sidebarRatio } as CSSProperties}
      >
        <div className="shrink-0 border-b border-foreground/15 px-5 py-5">
          <h1 className="font-[family-name:var(--font-montserrat)] text-sm font-bold tracking-wide text-foreground uppercase">
            Module {sampleModule.number}: {sampleModule.title}
          </h1>
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
          <p className="text-base font-medium leading-7 text-foreground/85">{sampleModule.description}</p>
          <p className="text-sm font-bold leading-6 text-foreground/55">{sampleModule.hint}</p>
          <div className="flex flex-col">
            <AccordionItem
              first
              last={sampleModule.lessons.length === 0}
              ratio={scores[sampleModule.challenge.id] ?? 0}
              open={target === sampleModule.challenge.id}
              title={sampleModule.challenge.navTitle}
              detail={sampleModule.challenge.navDetail}
              prominent
              onOpen={() => setTarget(sampleModule.challenge.id)}
            >
              <p className="font-medium">{sampleModule.challenge.detail}</p>
            </AccordionItem>
            {sampleModule.lessons.map((item, index) => (
              <AccordionItem
                key={item.challenge.id}
                first={false}
                last={index === sampleModule.lessons.length - 1}
                ratio={scores[item.challenge.id] ?? 0}
                open={target === item.challenge.id}
                title={`Lesson ${item.number} ${item.title}`}
                detail={item.summary}
                onOpen={() => setTarget(item.challenge.id)}
              >
                {item.body.map((paragraph) => (
                  <p key={paragraph} className="font-medium">{paragraph}</p>
                ))}
              </AccordionItem>
            ))}
          </div>
        </div>
      </aside>
      <button
        type="button"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize lessons"
        aria-valuemin={30}
        aria-valuemax={70}
        aria-valuenow={Math.round(sidebarRatio * 100)}
        className="group hidden w-3 shrink-0 cursor-col-resize lg:block"
        onPointerDown={(event) => startResize(event, sidebarRatio, setSidebarRatio)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setSidebarRatio(clampRatio(sidebarRatio - 0.02))
          if (event.key === "ArrowRight") setSidebarRatio(clampRatio(sidebarRatio + 0.02))
        }}
      >
        <span className="mx-auto block h-full w-px bg-border group-hover:w-0.5 group-hover:bg-primary" />
      </button>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-foreground/15 px-6 py-5">
          <h2 className="mx-auto max-w-2xl font-[family-name:var(--font-montserrat)] text-sm font-bold tracking-wide text-foreground uppercase">
            {lesson
              ? `Subchallenge ${sampleModule.number}.${lesson.number}: ${lesson.title}`
              : `Challenge ${sampleModule.number}: ${activeChallenge.title}`}
          </h2>
        </div>
        <div className="shrink-0 px-6 pt-10">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
          <p className="text-lg font-medium leading-8 text-foreground/85">{activeChallenge.summary}</p>
          <form onSubmit={submit}>
            <div className="flex items-end gap-2 rounded-[1.75rem] border border-border bg-secondary py-1.5 pr-2 pl-5 shadow-lg shadow-black/20">
              <label className="sr-only" htmlFor="instruction">
                Your instruction
              </label>
              <textarea
                id="instruction"
                name="instruction"
                rows={1}
                placeholder={
                  attempts.length > 0
                    ? "Enter the prompt to try again"
                    : "Enter your prompt to attempt the challenge"
                }
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return
                  event.preventDefault()
                  if (running || instruction.trim() === "") return
                  event.currentTarget.form?.requestSubmit()
                }}
                onInput={(event) => {
                  const field = event.currentTarget
                  field.style.height = "auto"
                  field.style.height = `${Math.min(field.scrollHeight, 160)}px`
                }}
                className="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1.5 pl-1 text-base font-semibold leading-6 outline-none placeholder:text-foreground/35"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={running || instruction.trim() === ""}
                className="mb-0.5 flex size-8 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 13V3M8 3 3.5 7.5M8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>
          </div>
        </div>
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          {current ? (
            <div ref={attemptRow} className="attempt-row relative z-10 flex w-full flex-nowrap items-end gap-1 overflow-x-auto" style={{ scrollbarWidth: "none", paddingRight: 48, paddingLeft: cursorIndex === 0 ? 0 : 24 }}>
              {attempts.map((item, index) => {
                const selected = index === cursorIndex
                const passed = attemptCleared(item)
                const atLeftEdge = selected && index === 0
                return (
                  <button
                    key={item.runId}
                    type="button"
                    data-selected={selected ? "true" : "false"}
                    aria-pressed={selected}
                    onClick={() => setCursor((items) => ({ ...items, [target]: index }))}
                    className={`inline-flex shrink-0 items-center gap-1.5 py-1.5 font-[family-name:var(--font-montserrat)] text-[13px] font-bold tracking-wide whitespace-nowrap uppercase ${
                      atLeftEdge ? "relative -mb-px rounded-tl-2xl rounded-tr-xl pr-3 pl-6 text-foreground" : selected ? "relative -mb-px rounded-t-xl px-3 text-foreground" : "px-3 text-foreground/40"
                    }`}
                    style={selected ? { background: "#181d28" } : undefined}
                  >
                    Attempt {index + 1}
                    {passed ? <PassedMark /> : null}
                    {selected && !atLeftEdge ? (
                      <span aria-hidden className="pointer-events-none absolute bottom-0" style={{ left: -28, width: 28, height: 28, background: "radial-gradient(circle at 0 0, transparent 26px, #181d28 28px)" }} />
                    ) : null}
                    {selected ? (
                      <span aria-hidden className="pointer-events-none absolute bottom-0" style={{ right: -28, width: 28, height: 28, background: "radial-gradient(circle at 100% 0, transparent 26px, #181d28 28px)" }} />
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : null}
          <div
            className={`flex min-h-0 flex-1 flex-col ${current && cursorIndex === 0 ? "rounded-tr-2xl" : "rounded-t-2xl"}`}
            style={{ background: "#181d28" }}
          >
            <div ref={thread} className={`min-h-0 flex-1 overflow-y-auto px-6 pt-5 ${current ? "" : "flex"}`}>
              {current ? (
                <div className="relative z-10 mx-auto w-full max-w-2xl">
                  <div className="flex flex-col items-end gap-1">
                    <p className="px-1 font-[family-name:var(--font-montserrat)] text-xs font-bold tracking-wide uppercase">
                      You
                    </p>
                    <p className="max-w-[80%] rounded-3xl bg-secondary px-4 py-3 text-base font-semibold leading-6">
                      {current.prompt}
                    </p>
                  </div>
                  <div className="mt-4">
                    <AgentReply
                      key={current.runId}
                      replies={current.replies}
                      pending={current.pending}
                      stars={current.stars}
                      starTotal={sampleModule.challenge.stars.length}
                    />
                  </div>
                </div>
              ) : (
                <p className="m-auto text-center text-base text-foreground/80">
                  Send a prompt to see a response
                </p>
              )}
            </div>
            {lesson ? (
              <LessonGoals
                criteria={activeChallenge.criteria.map((criterion) => ({
                  id: criterion.id,
                  label: criterionLabel(criterion),
                  passed: shown?.groups[0]?.criteria.find((entry) => entry.id === criterion.id)?.passed === true,
                }))}
              />
            ) : (
              <Goals
                ratio={
                  sampleModule.challenge.stars.length === 0
                    ? 0
                    : (shown?.stars ?? 0) / sampleModule.challenge.stars.length
                }
                markers={sampleModule.challenge.stars.map((star) => ({
                  id: String(star.stars),
                  filled: (shown?.stars ?? 0) >= star.stars,
                  star: true,
                  checks: star.criteria.map((criterion) => ({
                    id: criterion.id,
                    passed:
                      shown?.groups.find((group) => group.id === String(star.stars))?.criteria.find(
                        (entry) => entry.id === criterion.id,
                      )?.passed === true,
                    label: criterionLabel(criterion),
                  })),
                }))}
              />
            )}
          </div>
        </div>
      </section>
    </>
  )
}

function clampRatio(ratio: number) {
  return Math.min(0.7, Math.max(0.3, ratio))
}

function startResize(
  event: ReactPointerEvent<HTMLButtonElement>,
  startRatio: number,
  setRatio: (ratio: number) => void,
) {
  event.preventDefault()
  const parent = event.currentTarget.parentElement
  const track = (parent?.clientWidth ?? 1) - event.currentTarget.offsetWidth
  const startX = event.clientX
  const move = (moveEvent: PointerEvent) => {
    setRatio(clampRatio(startRatio + (moveEvent.clientX - startX) / track))
  }
  const stop = () => {
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", stop)
  }
  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", stop)
}

function progressRatio(state: AttemptState) {
  if (state.targetId === sampleModule.challenge.id) {
    const total = sampleModule.challenge.stars.length
    return total === 0 ? 0 : state.stars / total
  }
  const lesson = lessonFor(state.targetId)
  return criterionRatio(state, lesson?.challenge.criteria.length ?? 0)
}

function criterionRatio(state: AttemptState | null, total: number) {
  if (!state || total === 0) return 0
  const results = state.groups[0]?.criteria ?? []
  const passed = results.filter((result) => result.passed).length
  return passed / total
}

function AccordionItem({
  open,
  title,
  detail,
  prominent,
  first,
  last,
  ratio,
  onOpen,
  children,
}: {
  open: boolean
  title: string
  detail: string
  prominent?: boolean
  first: boolean
  last: boolean
  ratio: number
  onOpen: () => void
  children: ReactNode
}) {
  return (
    <div className={`flex gap-4 transition-colors duration-200 ease-out motion-reduce:transition-none ${open ? "-mx-5 bg-accent px-5" : ""}`}>
      <div className="flex w-4 shrink-0 flex-col items-center self-stretch">
        <span className={`h-5 w-px shrink-0 ${first ? "bg-transparent" : "bg-foreground/40"}`} />
        <TimelineMark kind={prominent ? "challenge" : "lesson"} active={open} ratio={ratio} />
        <span className={`min-h-5 w-px flex-1 ${last ? "bg-transparent" : "bg-foreground/40"}`} />
      </div>
      <div className="min-w-0 flex-1 py-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={onOpen}
          className="w-full bg-transparent p-0 text-left font-sans"
        >
          <span className={`block font-[family-name:var(--font-montserrat)] font-bold text-foreground ${prominent ? "text-lg" : "text-base"}`}>{title}</span>
          <span className="mt-2 block text-sm leading-6 text-foreground/75">{detail}</span>
        </button>
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="overflow-hidden">
            <div className="mt-4 flex flex-col gap-3 text-base leading-7 text-foreground/85">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LessonGoals({ criteria }: { criteria: { id: string; label: string; passed: boolean }[] }) {
  const done = criteria.filter((criterion) => criterion.passed).length
  const total = criteria.length
  const fill = total === 0 ? 0 : done / total
  return (
    <div className="w-full px-6 py-4" role="status">
      <div className="mb-3 flex flex-nowrap items-center justify-center gap-3">
        <ul className="flex shrink-0 flex-nowrap gap-1.5">
          {criteria.map((criterion) => (
            <li
              key={criterion.id}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs leading-4 transition-colors duration-200 ease-out motion-reduce:transition-none ${
                criterion.passed
                  ? "border-foreground bg-foreground/15 text-foreground"
                  : "border-foreground/25 text-foreground/55"
              }`}
            >
              <RingIcon filled={criterion.passed} />
              {criterion.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <GoalTrack
          ratio={fill}
          marks={criteria.map((criterion, index) => ({
            id: criterion.id,
            filled: index < done,
            node: <RingIcon filled={index < done} plate size={26} />,
          }))}
        />
      </div>
      <ScoreMark done={done} total={total} />
      </div>
      <p className="mt-3 text-center text-sm font-medium text-foreground/70">
        Collect each ring to complete the lesson challenge.
      </p>
    </div>
  )
}

function attemptCleared(item: AttemptRecord) {
  if (!item.graded || item.pending.some(Boolean)) return false
  if (item.graded.targetId === sampleModule.challenge.id) {
    return item.graded.stars >= sampleModule.challenge.stars.length
  }
  return item.graded.outcome === "pass"
}

function PassedMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" aria-label="Passed" className="shrink-0 text-[#3dce8a]">
      <path d="M2.5 7.2 5.4 10.2 11.5 3.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function defaultRun(replies: string[], pending?: boolean[]) {
  const finished = replies
    .map((reply, index) => ({ reply, index }))
    .filter((item) => pending?.[item.index] !== true)
  if (finished.length === 0) return 0
  const worst = finished.find((item) => item.reply.trim().toLowerCase() !== "hello world")
  return worst ? worst.index : finished[finished.length - 1].index
}

function AgentReply({
  replies,
  pending,
  stars,
  starTotal,
}: {
  replies: string[]
  pending?: boolean[]
  stars?: number
  starTotal: number
}) {
  const multi = replies.length > 1
  const signature = `${replies.join("\n")}|${pending?.map((slot) => (slot ? "1" : "0")).join("") ?? ""}`
  const [index, setIndex] = useState(() => defaultRun(replies, pending))
  useEffect(() => {
    setIndex((current) => (pending?.[current] === true ? defaultRun(replies, pending) : current))
  }, [signature])

  const shown = Math.min(index, Math.max(replies.length - 1, 0))
  const waiting = pending?.[shown] === true
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-1">
        {multi ? (
          replies.map((_, run) => {
            const selected = run === shown
            const slotWaiting = pending?.[run] === true
            return (
              <button
                key={run}
                type="button"
                onClick={() => setIndex(run)}
                className={`inline-flex items-center gap-1.5 font-[family-name:var(--font-montserrat)] text-xs font-bold tracking-wide uppercase ${
                  selected ? "text-foreground" : "text-foreground/45"
                }`}
              >
                Agent {run + 1}
                {slotWaiting ? <Spinner /> : stars === undefined ? null : ` (${stars}/${starTotal})`}
              </button>
            )
          })
        ) : (
          <p className="inline-flex items-center gap-1.5 font-[family-name:var(--font-montserrat)] text-xs font-bold tracking-wide uppercase">
            Agent
            {pending?.[0] ? <Spinner /> : null}
          </p>
        )}
      </div>
      {waiting ? (
        <p className="px-1 py-1 text-base font-semibold text-foreground/70">Thinking...</p>
      ) : (
        <p className="max-w-[80%] px-1 py-1 text-base font-semibold leading-6">{replies[shown]}</p>
      )}
    </>
  )
}

function Spinner() {
  return (
    <span
      className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
      role="status"
      aria-label="Running"
    />
  )
}

function ScoreMark({ done, total }: { done: number; total: number }) {
  return (
    <p className="shrink-0 text-base font-semibold leading-none tabular-nums">
      {done}/{total}
    </p>
  )
}

function tickLeft(index: number, count: number) {
  if (index === count - 1) return "calc(100% - 23px)"
  return `${markerSlot(index, count)}%`
}

function GoalTrack({
  ratio,
  marks,
}: {
  ratio: number
  marks: { id: string; filled: boolean; node: ReactNode }[]
}) {
  const complete = marks.length > 0 && ratio >= 1
  return (
    <div className="relative h-8">
      <div className="absolute inset-x-0 top-1/2 h-[18px] -translate-y-1/2 overflow-hidden rounded-[4px] bg-secondary">
        <div
          className="h-full bg-foreground transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }}
        />
      </div>
      {marks.map((mark, index) => (
        <div
          key={mark.id}
          className={`absolute top-1/2 z-10 -translate-y-1/2 ${index === marks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
          style={{ left: tickLeft(index, marks.length) }}
        >
          {mark.node}
        </div>
      ))}
      <svg
        width="11"
        height="11"
        viewBox="0 0 14 14"
        aria-hidden="true"
        className={`absolute top-1/2 right-[6px] z-10 -translate-y-1/2 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          complete ? "text-background opacity-100" : "opacity-0"
        }`}
      >
        <path d="M2.5 7.2 5.4 10.2 11.5 3.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function RingIcon({ filled, plate = false, size = 18 }: { filled: boolean; plate?: boolean; size?: number }) {
  if (plate) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" className="shrink-0">
        <circle cx="18" cy="18" r="16" fill="#202531" stroke={filled ? "#202531" : "#546e7a"} strokeWidth="1.5" />
        {filled ? (
          <circle cx="18" cy="18" r="11" fill="none" stroke="#eeffff" strokeWidth="6" />
        ) : (
          <circle cx="18" cy="18" r="9" fill="none" stroke="#546e7a" strokeWidth="1.5" />
        )}
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="5.25" fill="none" stroke="#eeffff" strokeWidth={filled ? 2.6 : 1.6} />
    </svg>
  )
}

function markerSlot(index: number, count: number) {
  if (count <= 1) return 100
  return ((index + 1) / count) * 100
}

function Goals({
  ratio,
  markers,
}: {
  ratio: number
  markers: {
    id: string
    filled: boolean
    label?: string
    star?: boolean
    checks?: { id: string; passed: boolean; label: string }[]
  }[]
}) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="w-full px-6 pt-8 pb-6" role="status">
      <div className="flex w-full items-center gap-3">
      <div className="min-w-0 flex-1">
        <GoalTrack
          ratio={ratio}
          marks={markers.map((marker, index) => ({
            id: marker.id,
            filled: marker.filled,
            node: (
              <div onMouseLeave={() => setOpen(null)}>
                <button
                  type="button"
                  aria-label={`${index + 1} star`}
                  aria-pressed={marker.filled}
                  onClick={() => setOpen(open === marker.id ? null : marker.id)}
                  onMouseEnter={() => setOpen(marker.id)}
                  className="block rounded-full"
                >
                  <StarIcon earned={marker.filled} size={26} plate />
                </button>
                {open === marker.id && marker.checks ? (
                  <div className={`absolute bottom-8 z-20 w-64 rounded-2xl border border-border bg-popover p-3 shadow-lg ${index === 0 ? "left-0" : index === markers.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
                    <ul className="flex flex-col gap-2">
                      {marker.checks.map((check, checkIndex) => (
                        <li key={check.id} className="flex items-center gap-2">
                          <NumberIcon n={checkIndex + 1} passed={check.passed} />
                          <span className="text-sm text-foreground/85">{check.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ),
          }))}
        />
      </div>
      <ScoreMark
        done={Math.round(Math.min(1, Math.max(0, ratio)) * markers.length)}
        total={markers.length}
      />
      </div>
      <p className="mt-3 text-center text-sm font-medium text-foreground/70">
        Collect all three stars to complete the challenge.
      </p>
    </div>
  )
}

function TimelineMark({
  kind,
  active,
  ratio,
}: {
  kind: "challenge" | "lesson"
  active: boolean
  ratio: number
}) {
  const stroke = active ? "#eeffff" : "#546e7a"
  const plate = active ? "#333b4f" : "#262c3b"
  const amount = `${(1 - Math.min(1, Math.max(0, ratio))) * 100}%`
  return (
    <span className="relative z-10 block h-4 w-4 shrink-0">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="absolute inset-0">
        {kind === "challenge" ? (
          <path d="M8 1.2 14.8 8 8 14.8 1.2 8Z" fill={plate} stroke={stroke} strokeWidth="1.5" />
        ) : (
          <circle cx="8" cy="8" r="5.5" fill={plate} stroke={stroke} strokeWidth="1.5" />
        )}
      </svg>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="absolute inset-0 transition-[clip-path] duration-300 ease-out motion-reduce:transition-none"
        style={{ clipPath: `inset(${amount} 0 0 0)` }}
      >
        {kind === "challenge" ? (
          <path d="M8 1.2 14.8 8 8 14.8 1.2 8Z" fill="#eeffff" stroke="#eeffff" strokeWidth="1.5" />
        ) : (
          <circle cx="8" cy="8" r="5.5" fill="#eeffff" stroke="#eeffff" strokeWidth="1.5" />
        )}
      </svg>
    </span>
  )
}

function StarIcon({ earned, size = 22, plate = false }: { earned: boolean; size?: number; plate?: boolean }) {
  const color = earned ? "#eeffff" : "#546e7a"
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill={plate ? "#202531" : "none"} stroke={color} strokeWidth="1.5" />
      <path
        d="M18 9.5 20.2 15l5.8.5-4.4 3.8 1.4 5.7L18 22.2 13 25l1.4-5.7L10 15.5 15.8 15Z"
        fill={earned ? color : "none"}
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NumberIcon({ n, passed }: { n: number; passed: boolean }) {
  const color = passed ? "#eeffff" : "#546e7a"
  return (
    <svg width="28" height="28" viewBox="0 0 36 36" aria-hidden="true" className="shrink-0">
      <circle cx="18" cy="18" r="16" fill="none" stroke={color} strokeWidth="1.5" />
      <text
        x="18"
        y="19"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize="14"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {n}
      </text>
    </svg>
  )
}

