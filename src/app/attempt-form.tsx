"use client"

import { useActionState, useState } from "react"
import { runQualifier, type AttemptState } from "./actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function AttemptForm() {
  const [instruction, setInstruction] = useState("")
  const [state, action, pending] = useActionState<AttemptState | null, FormData>(
    runQualifier,
    null,
  )

  return (
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
  )
}

function Result({ state }: { state: AttemptState | null }) {
  if (!state) return null

  if (state.outcome === "empty") {
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
    <div className="flex flex-col gap-3 text-sm" role="status">
      <p className="font-medium">Not yet. Read this, then try again.</p>
      <p className="text-muted-foreground">
        Reply: <span className="font-mono text-foreground">{state.reply}</span>
      </p>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-muted-foreground">
        <li>A single shot is one instruction and one reply. There is no second turn.</li>
        <li>Name the exact word the reply must be, and say that nothing else may be included.</li>
        <li>Run the attempt again.</li>
      </ol>
    </div>
  )
}
