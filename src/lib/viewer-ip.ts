export function viewerIp(raw: string | null): string {
  if (!raw) return "unknown"
  const first = raw.split(",")[0]?.trim() ?? ""
  if (!first) return "unknown"
  if (first.startsWith("[")) {
    const end = first.indexOf("]")
    return end > 1 ? first.slice(1, end) : "unknown"
  }
  const colon = first.lastIndexOf(":")
  if (colon > 0 && first.indexOf(":") === colon) return first.slice(0, colon)
  return first
}
