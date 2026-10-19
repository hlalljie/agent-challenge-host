"use client"

import { useActionState, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import { runQualifier, type AttemptState } from "./actions"
import { sampleChallenge } from "@/lib/challenge"
import { criterionLabel } from "@/lib/criteria"

type ChatMessage = {
  role: "user" | "assistant"
  text: string
  targetId: string
}

export function Challenge() {
  const [instruction, setInstruction] = useState("")
  const [target, setTarget] = useState(sampleChallenge.id)
  const [sidebarRatio, setSidebarRatio] = useState(0.5)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [state, action, pending] = useActionState<AttemptState | null, FormData>(
    runQualifier,
    null,
  )
  const seen = useRef<AttemptState | null>(null)
  const thread = useRef<HTMLDivElement>(null)
  const shown = state?.targetId === target ? state : null
  const lesson = sampleChallenge.lessons.find((item) => item.id === target)
  const visible = messages.filter((message) => message.targetId === target)

  useEffect(() => {
    if (!state || state === seen.current || state.outcome === "empty") return
    seen.current = state
    setMessages((current) => [
      ...current,
      { role: "assistant", text: state.reply, targetId: state.targetId },
    ])
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
        className="flex w-full shrink-0 flex-col gap-6 border-b border-border bg-sidebar px-5 py-6 lg:w-[calc((100%-0.75rem)*var(--pane))] lg:border-r lg:border-b-0"
        style={{ "--pane": sidebarRatio } as CSSProperties}
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Challenge</p>
          <h1 className="font-sans text-lg font-medium">{sampleChallenge.title}</h1>
          <p className="font-sans text-sm text-muted-foreground">{sampleChallenge.summary}</p>
        </div>
        <NavButton
          selected={target === sampleChallenge.id}
          title="Full challenge"
          detail="Stars from every rule"
          onClick={() => setTarget(sampleChallenge.id)}
        />
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Lessons</p>
          {sampleChallenge.lessons.map((item) => (
            <NavButton
              key={item.id}
              selected={target === item.id}
              title={item.title}
              detail={item.rule}
              onClick={() => setTarget(item.id)}
            />
          ))}
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
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-6 py-5">
          {lesson ? (
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              <h2 className="font-sans text-lg font-medium">{lesson.title}</h2>
              {lesson.body.map((paragraph) => (
                <p key={paragraph} className="font-sans text-sm leading-6 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              <CriteriaList
                labels={lesson.criteria.map((criterion) => ({
                  id: criterion.id,
                  label: criterionLabel(criterion),
                }))}
                results={shown?.groups[0]?.criteria}
              />
            </div>
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              <h2 className="font-sans text-lg font-medium">Full challenge</h2>
              <p className="font-sans text-sm leading-6 text-muted-foreground">
                One star is the exact reply. Two stars is that result three times in a row.
                Three stars also keeps the instruction under 12 words and names ready.
              </p>
              <Stars state={shown} />
            </div>
          )}
        </div>
        <div ref={thread} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
          {visible.length === 0 ? (
            <p className="m-auto max-w-md text-center font-sans text-sm text-muted-foreground">
              Write one instruction. The reply shows up here.
            </p>
          ) : (
            visible.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "user" ? (
                  <p className="max-w-[80%] rounded-3xl bg-secondary px-4 py-3 font-sans text-sm leading-6">
                    {message.text}
                  </p>
                ) : (
                  <p className="max-w-[80%] px-1 py-1 font-sans text-sm leading-6">{message.text}</p>
                )}
              </div>
            ))
          )}
          {pending ? (
            <p className="font-sans text-sm text-muted-foreground">Thinking...</p>
          ) : null}
        </div>
        <form action={submit} className="px-6 pb-6">
          <input type="hidden" name="target" value={target} />
          <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-[1.75rem] border border-border bg-secondary px-4 py-2 shadow-lg shadow-black/20">
            <label className="sr-only" htmlFor="instruction">
              Your instruction
            </label>
            <textarea
              id="instruction"
              name="instruction"
              rows={1}
              required
              placeholder="Message the challenge"
              disabled={pending}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              onInput={(event) => {
                const field = event.currentTarget
                field.style.height = "auto"
                field.style.height = `${Math.min(field.scrollHeight, 160)}px`
              }}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 font-sans text-sm leading-6 outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={pending || instruction.trim() === ""}
              className="mb-1 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 13V3M8 3 3.5 7.5M8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </form>
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

function NavButton({
  selected,
  title,
  detail,
  onClick,
}: {
  selected: boolean
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-left font-sans text-sm ${
        selected ? "bg-accent" : "hover:bg-accent/70"
      }`}
    >
      <span className="block font-medium">{title}</span>
      <span className="text-muted-foreground">{detail}</span>
    </button>
  )
}

function Stars({ state }: { state: AttemptState | null }) {
  const [open, setOpen] = useState<number | null>(null)
  const earned = state?.stars ?? 0
  const total = sampleChallenge.stars.length
  return (
    <div className="flex items-center gap-3" role="status">
      {sampleChallenge.stars.map((star) => {
        const filled = earned >= star.stars
        const results = state?.groups.find((group) => group.id === String(star.stars))?.criteria
        return (
          <div
            key={star.stars}
            className="relative"
            onMouseLeave={() => setOpen(null)}
          >
            <button
              type="button"
              aria-label={`${star.stars} star`}
              aria-pressed={filled}
              onClick={() => setOpen(open === star.stars ? null : star.stars)}
              onMouseEnter={() => setOpen(star.stars)}
              className="rounded-full p-1"
            >
              <StarIcon earned={filled} />
            </button>
            {open === star.stars ? (
              <div className="absolute top-11 left-0 z-10 w-64 rounded-2xl border border-border bg-popover p-3 shadow-lg">
                <CriteriaList
                  labels={star.criteria.map((criterion) => ({
                    id: criterion.id,
                    label: criterionLabel(criterion),
                  }))}
                  results={results}
                />
              </div>
            ) : null}
          </div>
        )
      })}
      <p className="font-sans text-sm text-muted-foreground">
        Progress:{" "}
        <span className={earned > 0 ? "text-foreground" : undefined}>{earned}</span>
        {` of ${total} stars`}
      </p>
    </div>
  )
}

function StarIcon({ earned }: { earned: boolean }) {
  const color = earned ? "#eeffff" : "#546e7a"
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
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

function CriteriaList({
  labels,
  results,
}: {
  labels: { id: string; label: string }[]
  results?: { id: string; passed: boolean; detail: string }[]
}) {
  return (
    <ul className="flex flex-col gap-1 font-sans text-sm">
      {labels.map((item) => {
        const result = results?.find((entry) => entry.id === item.id)
        return (
          <li key={item.id} className="text-muted-foreground">
            <span className={result ? (result.passed ? "text-foreground" : "text-destructive") : ""}>
              {result ? (result.passed ? "Pass" : "Fail") : "Needs"}
            </span>{" "}
            {item.label}
          </li>
        )
      })}
    </ul>
  )
}
