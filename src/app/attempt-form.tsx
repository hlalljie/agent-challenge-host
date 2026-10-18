"use client"

import { useActionState, useState } from "react"
import { runQualifier, type AttemptState } from "./actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export function Challenge() {
  const [instruction, setInstruction] = useState("")
  const [state, action, pending] = useActionState<AttemptState | null, FormData>(
    runQualifier,
    null,
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Qualifier</h1>
          </CardTitle>
          <CardDescription>
            Sample challenge. Write one instruction for the agent. You pass if its reply is
            exactly the word ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="instruction" className="text-sm font-medium">
                Your instruction
              </label>
              <Textarea
                id="instruction"
                name="instruction"
                rows={5}
                required
                placeholder="One instruction. One reply."
                disabled={pending}
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
              />
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Running..." : "Run attempt"}
            </Button>
            <Result state={state} />
          </form>
        </CardContent>
      </Card>
      <Lesson outcome={state?.outcome ?? null} />
    </>
  )
}

function Result({ state }: { state: AttemptState | null }) {
  if (!state || state.outcome === "empty") {
    if (!state) return null
    return (
      <p className="text-sm text-destructive" role="status">
        Write an instruction, then run it.
      </p>
    )
  }

  if (state.outcome === "pass") {
    return (
      <div className="flex flex-col gap-2 text-sm" role="status">
        <p className="font-medium">You can skip the lesson.</p>
        <p className="text-muted-foreground">
          Reply: <span className="font-mono text-foreground">{state.reply}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 text-sm" role="status">
      <p className="font-medium">
        Not yet.{" "}
        <a href="#lesson" className="underline underline-offset-4">
          Read the lesson
        </a>
        , then try again.
      </p>
      <p className="text-muted-foreground">
        Reply: <span className="font-mono text-foreground">{state.reply}</span>
      </p>
    </div>
  )
}

function Lesson({ outcome }: { outcome: AttemptState["outcome"] | null }) {
  const note =
    outcome === "pass"
      ? "You passed, so you can skip this."
      : outcome === "fail"
        ? "Read this, then try the qualifier again."
        : "Read this if the qualifier does not pass."

  return (
    <Card id="lesson">
      <CardHeader>
        <CardTitle>
          <h2>Lesson</h2>
        </CardTitle>
        <CardDescription>{note}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-muted-foreground">
          <li>A single shot is one instruction and one reply. There is no second turn.</li>
          <li>
            Name the exact reply. For this qualifier, that reply is the word{" "}
            <span className="font-mono text-foreground">ready</span>.
          </li>
          <li>Say that the reply must include nothing else. An extra sentence still fails.</li>
          <li>Run the attempt again.</li>
        </ol>
      </CardContent>
    </Card>
  )
}
