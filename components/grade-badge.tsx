import { scoreToGrade } from "@/lib/grade-utils"
import { cn } from "@/lib/utils"

function gradeColor(grade: string): string {
  if (grade === "A") return "bg-green-100 text-green-700 border-green-200"
  if (grade === "B+") return "bg-teal-100 text-teal-700 border-teal-200"
  if (grade === "B") return "bg-blue-100 text-blue-700 border-blue-200"
  if (grade === "C+") return "bg-cyan-100 text-cyan-700 border-cyan-200"
  if (grade === "C") return "bg-yellow-100 text-yellow-700 border-yellow-200"
  if (grade === "D+") return "bg-orange-100 text-orange-700 border-orange-200"
  if (grade === "D") return "bg-red-100 text-red-600 border-red-200"
  return "bg-gray-100 text-gray-600 border-gray-200"
}

interface GradeBadgeProps {
  score: number
  maxScore?: number
  className?: string
}

export function GradeBadge({ score, maxScore = 100, className }: GradeBadgeProps) {
  const pct = (score / maxScore) * 100
  const grade = scoreToGrade(pct)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        gradeColor(grade),
        className
      )}
    >
      {grade}
    </span>
  )
}
