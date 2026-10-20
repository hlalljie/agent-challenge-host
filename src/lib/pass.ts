export function replyPasses(reply: string): boolean {
  return reply.trim().toLowerCase() === "ready"
}
