export function scoreToGrade(score: number): string {
  if (score >= 80) return "A"
  if (score >= 75) return "B+"
  if (score >= 70) return "B"
  if (score >= 65) return "C+"
  if (score >= 60) return "C"
  if (score >= 55) return "D+"
  if (score >= 50) return "D"
  return "F"
}

export function scoreToGradeColor(score: number): string {
  if (score >= 80) return "text-green-600"
  if (score >= 70) return "text-blue-600"
  if (score >= 60) return "text-yellow-600"
  if (score >= 50) return "text-orange-600"
  return "text-red-600"
}

export function calculateWeightedScore(
  submissions: Array<{
    grade: { score: number } | null
    assignment: { weight: number; maxScore: number }
  }>,
  assignments: Array<{ weight: number }>
): number {
  const totalWeight = assignments.reduce((sum, a) => sum + a.weight, 0)
  if (totalWeight === 0) return 0

  let weightedScore = 0
  for (const sub of submissions) {
    if (sub.grade) {
      const pct = (sub.grade.score / sub.assignment.maxScore) * 100
      weightedScore += pct * (sub.assignment.weight / totalWeight)
    }
  }
  return Math.round(weightedScore * 10) / 10
}

export function getClassStats(scores: number[]): {
  mean: number
  median: number
  stdDev: number
  highest: number
  lowest: number
} {
  if (scores.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, highest: 0, lowest: 0 }
  }

  const sorted = [...scores].sort((a, b) => a - b)
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length

  return {
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    highest: sorted[sorted.length - 1],
    lowest: sorted[0],
  }
}
