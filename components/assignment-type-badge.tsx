import type { AssignmentType } from "@prisma/client"
import { cn } from "@/lib/utils"

const CONFIG: Record<AssignmentType, { label: string; color: string }> = {
  HOMEWORK: { label: "การบ้าน", color: "bg-blue-100 text-blue-700 border-blue-200" },
  QUIZ: { label: "แบบทดสอบ", color: "bg-purple-100 text-purple-700 border-purple-200" },
  MIDTERM: { label: "สอบกลางภาค", color: "bg-orange-100 text-orange-700 border-orange-200" },
  FINAL: { label: "สอบปลายภาค", color: "bg-red-100 text-red-700 border-red-200" },
  PROJECT: { label: "โปรเจกต์", color: "bg-green-100 text-green-700 border-green-200" },
}

interface AssignmentTypeBadgeProps {
  type: AssignmentType
  className?: string
}

export function AssignmentTypeBadge({ type, className }: AssignmentTypeBadgeProps) {
  const { label, color } = CONFIG[type]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        color,
        className
      )}
    >
      {label}
    </span>
  )
}
