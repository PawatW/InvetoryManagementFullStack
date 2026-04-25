import { differenceInDays, isPast } from "date-fns"
import { cn } from "@/lib/utils"

interface DeadlineBadgeProps {
  dueDate: Date
  className?: string
}

export function DeadlineBadge({ dueDate, className }: DeadlineBadgeProps) {
  const now = new Date()
  const days = differenceInDays(dueDate, now)
  const overdue = isPast(dueDate)

  let label: string
  let color: string

  if (overdue) {
    label = `เกิน ${Math.abs(days)} วัน`
    color = "bg-red-100 text-red-700 border-red-200"
  } else if (days === 0) {
    label = "วันนี้"
    color = "bg-red-100 text-red-700 border-red-200"
  } else if (days <= 3) {
    label = `เหลือ ${days} วัน`
    color = "bg-orange-100 text-orange-700 border-orange-200"
  } else if (days <= 7) {
    label = `เหลือ ${days} วัน`
    color = "bg-yellow-100 text-yellow-700 border-yellow-200"
  } else {
    label = `เหลือ ${days} วัน`
    color = "bg-green-100 text-green-700 border-green-200"
  }

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
