import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AttemptForm } from "./attempt-form"

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Qualifier</h1>
          </CardTitle>
          <CardDescription>
            Sample challenge. Write one instruction for the agent. You pass if its reply is
            exactly the word ready. The runner is a local stub, so this works before OpenCode
            is connected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttemptForm />
        </CardContent>
      </Card>
    </main>
  )
}
