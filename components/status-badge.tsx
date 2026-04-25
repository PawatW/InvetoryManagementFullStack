import type { SubmissionStatus } from "@prisma/client"
import { cn } from "@/lib/utils"

const CONFIG: Record<SubmissionStatus, { label: string; color: string }> = {
  SUBMITTED: { label: "ส่งแล้ว", color: "bg-blue-100 text-blue-700 border-blue-200" },
  LATE: { label: "ส่งช้า", color: "bg-orange-100 text-orange-700 border-orange-200" },
  NOT_SUBMITTED: { label: "ยังไม่ส่ง", color: "bg-gray-100 text-gray-600 border-gray-200" },
  GRADED: { label: "ตรวจแล้ว", color: "bg-green-100 text-green-700 border-green-200" },
}

interface StatusBadgeProps {
  status: SubmissionStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, color } = CONFIG[status]
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
