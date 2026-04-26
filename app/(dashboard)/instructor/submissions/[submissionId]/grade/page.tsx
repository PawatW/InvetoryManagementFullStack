import { notFound } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { th } from "date-fns/locale"
import { ArrowLeft, Download, FileText } from "lucide-react"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { getNextSubmission, getPrevSubmission } from "@/app/actions/grades"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/status-badge"
import { AssignmentTypeBadge } from "@/components/assignment-type-badge"
import { GradeForm } from "@/components/grade-form"

interface Props {
  params: { submissionId: string }
}

export default async function GradeSubmissionPage({ params }: Props) {
  const user = await requireRole("INSTRUCTOR")

  const submission = await db.submission.findFirst({
    where: {
      id: params.submissionId,
      assignment: { course: { instructorId: user.id } },
    },
    include: {
      student: { select: { id: true, name: true, email: true, yearLevel: true } },
      assignment: {
        include: {
          course: { select: { id: true, code: true, title: true } },
          rubrics: { orderBy: { order: "asc" } },
        },
      },
      grade: true,
    },
  })

  if (!submission) notFound()

  const [prevId, nextId] = await Promise.all([
    getPrevSubmission(submission.assignmentId, params.submissionId),
    getNextSubmission(submission.assignmentId, params.submissionId),
  ])

  const existingGrade = submission.grade
    ? {
        score: submission.grade.score,
        instructorNote: submission.grade.instructorNote,
        privateNote: submission.grade.privateNote,
        rubricScores:
          (submission.grade.rubricScores as Record<string, number> | null) ?? null,
      }
    : null

  const initials = submission.student.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link href={`/dashboard/instructor/assignments/${submission.assignmentId}/submissions`}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          กลับรายการส่งงาน
        </Link>
      </Button>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* ── Left: Student info ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Student card */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 text-lg">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-base">{submission.student.name}</p>
                  <p className="text-sm text-muted-foreground">{submission.student.email}</p>
                  {submission.student.yearLevel && (
                    <p className="text-xs text-muted-foreground">{submission.student.yearLevel}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Submission info */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">วันที่ส่ง</span>
                  <span>
                    {format(submission.submittedAt, "d MMM yy HH:mm", { locale: th })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">สถานะ</span>
                  <StatusBadge status={submission.status} />
                </div>
              </div>

              {/* File */}
              {submission.fileName && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{submission.fileName}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Student note */}
              {submission.studentNote && (
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">หมายเหตุจากนักศึกษา</p>
                  <p className="text-sm">{submission.studentNote}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignment info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                ข้อมูลงาน
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-primary text-sm">
                  {submission.assignment.course.code}
                </span>
                <AssignmentTypeBadge type={submission.assignment.type} />
              </div>
              <p className="font-medium">{submission.assignment.title}</p>
              <div className="flex gap-4 text-muted-foreground">
                <span>คะแนนเต็ม {submission.assignment.maxScore}</span>
                <span>น้ำหนัก {submission.assignment.weight}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Grading Panel ──────────────────────────────── */}
        <div className="lg:col-span-3">
          <Card className="lg:sticky lg:top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ตรวจงาน</CardTitle>
            </CardHeader>
            <CardContent>
              <GradeForm
                submissionId={params.submissionId}
                maxScore={submission.assignment.maxScore}
                rubrics={submission.assignment.rubrics.map((r) => ({
                  id: r.id,
                  label: r.label,
                  maxPoints: r.maxPoints,
                }))}
                existingGrade={existingGrade}
                prevId={prevId}
                nextId={nextId}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
