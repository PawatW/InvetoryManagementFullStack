import { notFound } from "next/navigation"
import { format } from "date-fns"
import { th } from "date-fns/locale"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AssignmentTypeBadge } from "@/components/assignment-type-badge"
import { DeadlineBadge } from "@/components/deadline-badge"
import { SubmitCard } from "@/components/submit-card"

interface Props {
  params: { assignmentId: string }
}

export default async function AssignmentDetailPage({ params }: Props) {
  const user = await requireRole("STUDENT")

  const assignment = await db.assignment.findUnique({
    where: { id: params.assignmentId },
    include: {
      course: {
        include: {
          enrollments: {
            where: { studentId: user.id, status: "ACTIVE" },
          },
        },
      },
      rubrics: { orderBy: { order: "asc" } },
      submissions: {
        where: { studentId: user.id },
        include: { grade: true },
      },
    },
  })

  // Must exist and student must be enrolled
  if (!assignment || assignment.course.enrollments.length === 0) notFound()

  const submission = assignment.submissions[0] ?? null

  // Serialize for client component (no Date objects)
  const serializedSubmission = submission
    ? {
        status: submission.status,
        fileName: submission.fileName,
        submittedAt: submission.submittedAt.toISOString(),
        studentNote: submission.studentNote,
        isLate: submission.isLate,
        grade: submission.grade
          ? {
              score: submission.grade.score,
              instructorNote: submission.grade.instructorNote,
              rubricScores:
                (submission.grade.rubricScores as Record<string, number> | null) ?? null,
            }
          : null,
      }
    : null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-5 gap-6">
        {/* ── Left: Assignment details ─────────────────────────────── */}
        <div className="lg:col-span-3 space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-primary">
                {assignment.course.code}
              </span>
            </div>
            <h1 className="text-2xl font-bold">{assignment.title}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <AssignmentTypeBadge type={assignment.type} />
              <span className="text-sm text-muted-foreground">น้ำหนัก {assignment.weight}%</span>
              <span className="text-sm text-muted-foreground">คะแนนเต็ม {assignment.maxScore}</span>
            </div>
          </div>

          {/* Description */}
          {assignment.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  คำอธิบายงาน
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {assignment.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Deadline */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">กำหนดส่ง</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {format(assignment.dueDate, "EEEE d MMMM yyyy 'เวลา' HH:mm 'น.'", {
                      locale: th,
                    })}
                  </p>
                </div>
                <DeadlineBadge dueDate={assignment.dueDate} />
              </div>
              {assignment.allowLate && (
                <p className="text-xs text-muted-foreground mt-2">
                  อนุญาตให้ส่งช้าได้
                </p>
              )}
            </CardContent>
          </Card>

          {/* Rubric Criteria */}
          {assignment.rubrics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  เกณฑ์การตรวจ (Rubric)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เกณฑ์</TableHead>
                      <TableHead className="text-right">คะแนนสูงสุด</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignment.rubrics.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.label}</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {r.maxPoints}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell className="text-sm font-semibold">รวม</TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {assignment.rubrics.reduce((s, r) => s + r.maxPoints, 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: Submit card ───────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6">
            <SubmitCard
              assignmentId={assignment.id}
              maxScore={assignment.maxScore}
              dueDate={assignment.dueDate.toISOString()}
              allowLate={assignment.allowLate}
              submission={serializedSubmission}
              rubrics={assignment.rubrics.map((r) => ({
                id: r.id,
                label: r.label,
                maxPoints: r.maxPoints,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
