"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GradeBadge } from "@/components/grade-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface StudentPerfRow {
  studentId: string
  name: string
  email: string
  yearLevel: string | null
  weightedScore: number
  submitted: number
  total: number
  missing: number
}

type SortKey = "name" | "yearLevel" | "weightedScore" | "submitted" | "missing"
type SortDir = "asc" | "desc"

export function StudentPerformanceTable({
  rows,
  courseId,
}: {
  rows: StudentPerfRow[]
  courseId: string
}) {
  const [sortKey, setSortKey] = useState<SortKey>("weightedScore")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("desc") }
  }

  const sorted = [...rows].sort((a, b) => {
    const aVal = a[sortKey] ?? ""
    const bVal = b[sortKey] ?? ""
    const cmp =
      typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), "th")
    return sortDir === "asc" ? cmp : -cmp
  })

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40 inline" />
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 inline" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 inline" />
  }

  return (
    <div className="rounded-md border bg-background overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button onClick={() => handleSort("name")} className="flex items-center text-xs font-medium">
                ชื่อ <SortIcon k="name" />
              </button>
            </TableHead>
            <TableHead>
              <button onClick={() => handleSort("yearLevel")} className="flex items-center text-xs font-medium">
                ชั้นปี <SortIcon k="yearLevel" />
              </button>
            </TableHead>
            <TableHead>
              <button onClick={() => handleSort("weightedScore")} className="flex items-center text-xs font-medium">
                คะแนนรวม <SortIcon k="weightedScore" />
              </button>
            </TableHead>
            <TableHead className="text-center">
              <button onClick={() => handleSort("submitted")} className="flex items-center mx-auto text-xs font-medium">
                ส่งงาน <SortIcon k="submitted" />
              </button>
            </TableHead>
            <TableHead className="text-center">
              <button onClick={() => handleSort("missing")} className="flex items-center mx-auto text-xs font-medium">
                ขาดส่ง <SortIcon k="missing" />
              </button>
            </TableHead>
            <TableHead>ประมาณเกรด</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow
              key={row.studentId}
              className={cn(
                row.weightedScore > 0 && row.weightedScore < 50 &&
                  "bg-red-50/70 hover:bg-red-50 dark:bg-red-950/20",
                row.weightedScore >= 50 && row.weightedScore < 60 &&
                  "bg-yellow-50/60 hover:bg-yellow-50 dark:bg-yellow-950/20"
              )}
            >
              <TableCell>
                <p className="font-medium text-sm">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.email}</p>
              </TableCell>
              <TableCell className="text-sm">{row.yearLevel ?? "—"}</TableCell>
              <TableCell className="text-sm font-semibold">
                {row.weightedScore > 0 ? `${row.weightedScore.toFixed(1)}%` : "—"}
              </TableCell>
              <TableCell className="text-center text-sm">
                {row.submitted}/{row.total}
              </TableCell>
              <TableCell className="text-center text-sm">
                {row.missing > 0 ? (
                  <span className="text-red-600 font-semibold">{row.missing}</span>
                ) : (
                  <span className="text-green-600">0</span>
                )}
              </TableCell>
              <TableCell>
                {row.weightedScore > 0 ? (
                  <GradeBadge score={row.weightedScore} maxScore={100} />
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/instructor/courses/${courseId}/students/${row.studentId}`}>
                    ดูรายละเอียด
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
