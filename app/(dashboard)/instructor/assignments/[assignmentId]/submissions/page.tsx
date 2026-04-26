import { notFound } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { th } from "date-fns/locale"
import { ArrowLeft } from "lucide-react"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AssignmentTypeBadge } from "@/components/assignment-type-badge"
import { DeadlineBadge } from "@/components/deadline-badge"
import {
  SubmissionsTable,
  type SubmissionRow,
} from "@/components/submissions-table"
import type { SubmissionStatus } from "@prisma/client"

interface Props {
  params: { assignmentId: string }
  searchParams: { filter?: string }
}

const FILTER_LABELS: Record<string, string> = {
  all: "ทั้งหมด",
  pending: "รอตรวจ",
  graded: "ตรวจแล้ว",
  not_submitted: "ยังไม่ส่ง",
}

export default async function SubmissionsPage({ params, searchParams }: Props) {
  const user = await requireRole("INSTRUCTOR")
  const filter = searchParams.filter ?? "all"

  const assignment = await db.assignment.findFirst({
    where: { id: params.assignmentId, course: { instructorId: user.id } },
    include: {
      course: {
        include: {
          enrollments: {
            where: { status: "ACTIVE" },
            include: { student: { select: { id: true, name: true, email: true, yearLevel: true } } },
          },
        },
      },
      submissions: {
        include: {
          student: { select: { id: true, name: true, email: true, yearLevel: true } },
          grade: { select: { score: true } },
        },
        orderBy: { student: { name: "asc" } },
      },
    },
  })

  if (!assignment) notFound()

  const totalEnrolled = assignment.course.enrollments.length
  const submittedMap = new Map(assignment.submissions.map((s) => [s.studentId, s]))

  // Build unified rows
  const allRows: SubmissionRow[] = assignment.course.enrollments.map((e) => {
    const sub = submittedMap.get(e.studentId)
    if (!sub) {
      return {
        studentId: e.studentId,
        studentName: e.student.name,
        studentEmail: e.student.email,
        yearLevel: e.student.yearLevel,
        submissionId: null,
        submittedAt: null,
        status: "NOT_SUBMITTED" as const,
        score: null,
        maxScore: assignment.maxScore,
        isLate: false,
      }
    }
    return {
      studentId: e.studentId,
      studentName: e.student.name,
      studentEmail: e.student.email,
      yearLevel: e.student.yearLevel,
      submissionId: sub.id,
      submittedAt: sub.submittedAt.toISOString(),
      status: sub.status as SubmissionStatus,
      score: sub.grade?.score ?? null,
      maxScore: assignment.maxScore,
      isLate: sub.isLate,
    }
  })

  // Apply status filter
  const filteredRows = allRows.filter((r) => {
    if (filter === "pending") return r.status === "SUBMITTED" || r.status === "LATE"
    if (filter === "graded") return r.status === "GRADED"
    if (filter === "not_submitted") return r.status === "NOT_SUBMITTED"
    return true
  })

  const pendingCount = allRows.filter((r) => r.status === "SUBMITTED" || r.status === "LATE").length
  const gradedCount = allRows.filter((r) => r.status === "GRADED").length
  const notSubmittedCount = allRows.filter((r) => r.status === "NOT_SUBMITTED").length
  const submittedCount = totalEnrolled - notSubmittedCount

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Back + Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
          <Link href={`/dashboard/instructor/courses/${assignment.courseId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            กลับ
          </Link>
        </Button>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-semibold text-primary">
            {assignment.course.code}
          </span>
          <AssignmentTypeBadge type={assignment.type} />
        </div>
        <h1 className="text-2xl font-bold">{assignment.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
          <span>Deadline: {format(assignment.dueDate, "d MMM yy HH:mm", { locale: th })}</span>
          <DeadlineBadge dueDate={assignment.dueDate} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "ส่งแล้ว", value: submittedCount, color: "text-blue-600" },
          { label: "รอตรวจ", value: pendingCount, color: "text-orange-600" },
          { label: "ตรวจแล้ว", value: gradedCount, color: "text-green-600" },
          { label: "ยังไม่ส่ง", value: notSubmittedCount, color: "text-gray-500" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4 text-center">
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(FILTER_LABELS).map(([key, label]) => (
          <Link key={key} href={`?filter=${key}`}>
            <Badge
              variant={filter === key ? "default" : "outline"}
              className="cursor-pointer px-3 py-1 text-sm"
            >
              {label}
              {key === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-white/30 px-1.5 text-xs">
                  {pendingCount}
                </span>
              )}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Table with client-side search */}
      <SubmissionsTable rows={filteredRows} />
    </div>
  )
}
