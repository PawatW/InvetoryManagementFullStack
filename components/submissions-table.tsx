"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { th } from "date-fns/locale"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/status-badge"
import { GradeBadge } from "@/components/grade-badge"
import { cn } from "@/lib/utils"
import type { SubmissionStatus } from "@prisma/client"

export interface SubmissionRow {
  studentId: string
  studentName: string
  studentEmail: string
  yearLevel: string | null
  submissionId: string | null
  submittedAt: string | null
  status: SubmissionStatus | "NOT_SUBMITTED"
  score: number | null
  maxScore: number
  isLate: boolean
}

interface SubmissionsTableProps {
  rows: SubmissionRow[]
}

export function SubmissionsTable({ rows }: SubmissionsTableProps) {
  const [search, setSearch] = useState("")

  const filtered = rows.filter((r) =>
    r.studentName.toLowerCase().includes(search.toLowerCase()) ||
    r.studentEmail.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาชื่อนักศึกษา..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อนักศึกษา</TableHead>
              <TableHead>ชั้นปี</TableHead>
              <TableHead>วันที่ส่ง</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
              <TableHead className="text-center">คะแนน</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => {
              const notSubmitted = row.status === "NOT_SUBMITTED"
              const isLateRow = row.isLate && !notSubmitted

              return (
                <TableRow
                  key={row.studentId}
                  className={cn(
                    isLateRow && "bg-orange-50/60 hover:bg-orange-50",
                    notSubmitted && "bg-gray-50/60 hover:bg-gray-50 opacity-70"
                  )}
                >
                  <TableCell>
                    <p className="font-medium text-sm">{row.studentName}</p>
                    <p className="text-xs text-muted-foreground">{row.studentEmail}</p>
                  </TableCell>
                  <TableCell className="text-sm">{row.yearLevel ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.submittedAt
                      ? format(new Date(row.submittedAt), "d MMM yy HH:mm", { locale: th })
                      : <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {notSubmitted ? (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border-gray-200">
                        ยังไม่ส่ง
                      </span>
                    ) : (
                      <StatusBadge status={row.status as SubmissionStatus} />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.score !== null ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold">
                          {row.score}/{row.maxScore}
                        </span>
                        <GradeBadge score={row.score} maxScore={row.maxScore} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.submissionId && !notSubmitted ? (
                      <Button variant="default" size="sm" asChild>
                        <Link href={`/dashboard/instructor/submissions/${row.submissionId}/grade`}>
                          ตรวจงาน
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" disabled>
                        ยังไม่ส่ง
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        แสดง {filtered.length} / {rows.length} รายการ
      </p>
    </div>
  )
}
