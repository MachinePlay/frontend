export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const m = Math.round(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

export function formatBytes(n: number): string {
  const TB = 1024 ** 4
  const GB = 1024 ** 3
  const MB = 1024 ** 2
  if (n >= TB) return `${(n / TB).toFixed(1)} TB`
  if (n >= GB) return `${(n / GB).toFixed(1)} GB`
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}

export function formatClock(s: number): string {
  if (s >= 60) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }
  return s.toFixed(1)
}
