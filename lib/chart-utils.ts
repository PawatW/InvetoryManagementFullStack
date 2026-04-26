export interface DistributionBucket {
  range: string
  count: number
  color: string
}

export interface CompletionRow {
  name: string
  onTime: number
  late: number
  missing: number
}

export interface TrendPoint {
  name: string
  mine: number | null
  avg: number | null
}

export function getScoreDistribution(scores: number[]): DistributionBucket[] {
  const buckets: DistributionBucket[] = Array.from({ length: 10 }, (_, i) => {
    const lo = i * 10
    const hi = i < 9 ? lo + 9 : 100
    const color = hi < 50 ? "#ef4444" : lo >= 70 ? "#22c55e" : "#f59e0b"
    return { range: i < 9 ? `${lo}-${hi}` : "90-100", count: 0, color }
  })

  for (const score of scores) {
    const idx = Math.min(Math.floor(Math.max(0, Math.min(100, score)) / 10), 9)
    buckets[idx].count++
  }

  return buckets
}

export function getCompletionRate(
  assignments: { id: string; title: string }[],
  submissions: { assignmentId: string; isLate: boolean }[],
  totalStudents: number
): CompletionRow[] {
  return assignments.map((a) => {
    const subs = submissions.filter((s) => s.assignmentId === a.id)
    const onTime = subs.filter((s) => !s.isLate).length
    const late = subs.filter((s) => s.isLate).length
    const missing = Math.max(0, totalStudents - subs.length)
    const name = a.title.length > 22 ? a.title.slice(0, 22) + "…" : a.title
    return { name, onTime, late, missing }
  })
}

export function getTrendData(
  myGradedSubs: Array<{
    score: number
    maxScore: number
    title: string
    assignmentId: string
  }>,
  classAvgByAssignment: Map<string, number>
): TrendPoint[] {
  return myGradedSubs.map((s) => ({
    name: s.title.length > 15 ? s.title.slice(0, 15) + "…" : s.title,
    mine: Math.round((s.score / s.maxScore) * 1000) / 10,
    avg: Math.round((classAvgByAssignment.get(s.assignmentId) ?? 0) * 10) / 10,
  }))
}
