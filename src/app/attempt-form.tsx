"use client"

import { useActionState, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { runQualifier, type AttemptState } from "./actions"
import { lessonFor, sampleModule } from "@/lib/challenge"
import { criterionLabel } from "@/lib/criteria"

type ChatMessage = {
  role: "user" | "assistant"
  text: string
  targetId: string
}

export function Challenge() {
  const [instruction, setInstruction] = useState("")
  const [target, setTarget] = useState(sampleModule.challenge.id)
  const [sidebarRatio, setSidebarRatio] = useState(0.5)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [state, action, pending] = useActionState<AttemptState | null, FormData>(
    runQualifier,
    null,
  )
  const seen = useRef<AttemptState | null>(null)
  const thread = useRef<HTMLDivElement>(null)
  const shown = state?.targetId === target ? state : null
  const lesson = lessonFor(target)
  const activeChallenge = lesson?.challenge ?? sampleModule.challenge
  const visible = messages.filter((message) => message.targetId === target)

  useEffect(() => {
    if (!state || state === seen.current || state.outcome === "empty") return
    seen.current = state
    setMessages((current) => [
      ...current,
      { role: "assistant", text: state.reply, targetId: state.targetId },
    ])
    setScores((current) => ({ ...current, [state.targetId]: progressRatio(state) }))
  }, [state])

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight })
  }, [visible.length, pending])

  function submit(formData: FormData) {
    const text = instruction.trim()
    if (!text) return
    setMessages((current) => [...current, { role: "user", text, targetId: target }])
    setInstruction("")
    return action(formData)
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
        <div ref={thread} className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pt-10 pb-8">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
          <p className="text-lg font-medium leading-8 text-foreground/85">{activeChallenge.summary}</p>
          <form action={submit}>
            <input type="hidden" name="target" value={target} />
            <div className="flex items-end gap-2 rounded-[1.75rem] border border-border bg-secondary py-1.5 pr-2 pl-5 shadow-lg shadow-black/20">
              <label className="sr-only" htmlFor="instruction">
                Your instruction
              </label>
              <textarea
                id="instruction"
                name="instruction"
                rows={1}
                required
                placeholder={
                  visible.length > 0
                    ? "Enter the prompt to try again"
                    : "Enter your prompt to attempt the challenge"
                }
                disabled={pending}
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return
                  event.preventDefault()
                  if (pending || instruction.trim() === "") return
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
                disabled={pending || instruction.trim() === ""}
                className="mb-0.5 flex size-8 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 13V3M8 3 3.5 7.5M8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>
          </div>
          {visible.length === 0 ? (
            <p className="m-auto text-center text-base text-foreground/80">
              Send a prompt to see a response
            </p>
          ) : (
            visible.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "user" ? (
                  <p className="max-w-[80%] rounded-3xl bg-secondary px-4 py-3 text-base leading-6">
                    {message.text}
                  </p>
                ) : (
                  <p className="max-w-[80%] px-1 py-1 text-base leading-6">{message.text}</p>
                )}
              </div>
            ))
          )}
          {pending ? <p className="mx-auto w-full max-w-2xl text-base text-foreground/70">Thinking...</p> : null}
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
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 px-6 py-4" role="status">
      <p className="font-[family-name:var(--font-montserrat)] text-xs font-bold tracking-wide uppercase">
        Goals
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {criteria.map((criterion) => (
          <li
            key={criterion.id}
              className={`rounded-full border px-2 py-0.5 text-xs leading-4 transition-colors duration-200 ease-out motion-reduce:transition-none ${
              criterion.passed
                ? "border-foreground bg-foreground/15 text-foreground"
                : "border-foreground/25 text-foreground/55"
            }`}
          >
            {criterion.label}
          </li>
        ))}
      </ul>
      <p className="text-sm text-foreground/80">
        {done} of {total}
      </p>
      <div>
        <div className="relative h-4 overflow-hidden rounded-[4px] bg-secondary">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${fill * 100}%` }}
          />
          {criteria.map((criterion, index) => (
            <span
              key={criterion.id}
              className={`absolute top-0 h-full w-0.5 ${index < total - 1 ? "-translate-x-1/2" : ""}`}
              style={{
                left: index === total - 1 ? "calc(100% - 2px)" : `${markerSlot(index, total)}%`,
                backgroundColor: index < done ? "#eeffff" : "#546e7a",
              }}
            />
          ))}
        </div>
      </div>
    </div>
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
    <div className="px-6 pt-10 pb-6" role="status">
      <div className="flex items-center gap-2.5">
      <p className="shrink-0 font-[family-name:var(--font-montserrat)] text-xs font-bold tracking-wide uppercase">Goals</p>
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-x-0 bottom-full mb-2 h-8">
          {markers.map((marker, index) => {
            const at = markerSlot(index, markers.length)
            const shift = index === markers.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
            const align = index === 0 ? "left-0" : index === markers.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"
            return (
              <div
                key={marker.id}
                className={`absolute bottom-0 ${shift}`}
                style={{ left: `${at}%` }}
                onMouseLeave={() => setOpen(null)}
              >
                {marker.star ? (
                  <button
                    type="button"
                    aria-label={`${index + 1} star`}
                    aria-pressed={marker.filled}
                    onClick={() => setOpen(open === marker.id ? null : marker.id)}
                    onMouseEnter={() => setOpen(marker.id)}
                    className="block rounded-full"
                  >
                    <StarIcon earned={marker.filled} />
                  </button>
                ) : (
                  <span
                    className={`block w-40 text-xs leading-4 ${marker.filled ? "text-foreground" : "text-foreground/55"} ${index === markers.length - 1 ? "text-right" : ""}`}
                  >
                    {marker.label}
                  </span>
                )}
                {open === marker.id && marker.checks ? (
                  <div className={`absolute bottom-9 z-10 w-64 rounded-2xl border border-border bg-popover p-3 shadow-lg ${align}`}>
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
            )
          })}
        </div>
        <div className="relative h-4 overflow-hidden rounded-[4px] bg-secondary">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }}
          />
          {markers.map((marker, index) => (
            <span
              key={marker.id}
              className={`absolute top-0 h-full w-0.5 ${index < markers.length - 1 ? "-translate-x-1/2" : ""}`}
              style={{
                left: index === markers.length - 1 ? "calc(100% - 2px)" : `${markerSlot(index, markers.length)}%`,
                backgroundColor: marker.filled ? "#eeffff" : "#546e7a",
              }}
            />
          ))}
        </div>
      </div>
      </div>
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

function StarIcon({ earned }: { earned: boolean }) {
  const color = earned ? "#eeffff" : "#546e7a"
  return (
    <svg width="22" height="22" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="none" stroke={color} strokeWidth="1.5" />
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

