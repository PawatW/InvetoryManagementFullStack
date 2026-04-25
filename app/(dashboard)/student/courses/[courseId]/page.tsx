import { notFound } from "next/navigation"
import Link from "next/link"
import { format, isPast } from "date-fns"
import { th } from "date-fns/locale"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { calculateWeightedScore } from "@/lib/grade-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AssignmentTypeBadge } from "@/components/assignment-type-badge"
import { StatusBadge } from "@/components/status-badge"
import { DeadlineBadge } from "@/components/deadline-badge"
import { GradeBadge } from "@/components/grade-badge"

interface Props {
  params: { courseId: string }
}

export default async function StudentCourseDetailPage({ params }: Props) {
  const user = await requireRole("STUDENT")

  const enrollment = await db.enrollment.findFirst({
    where: { studentId: user.id, courseId: params.courseId, status: "ACTIVE" },
    include: {
      course: {
        include: {
          instructor: { select: { name: true } },
          assignments: {
            include: {
              submissions: {
                where: { studentId: user.id },
                include: { grade: true },
              },
            },
            orderBy: { dueDate: "asc" },
          },
        },
      },
    },
  })

  if (!enrollment) notFound()

  const { course } = enrollment
  const total = course.assignments.length
  const submitted = course.assignments.filter((a) => a.submissions.length > 0).length
  const remaining = total - submitted

  const weightedScore = calculateWeightedScore(
    course.assignments.flatMap((a) =>
      a.submissions.map((s) => ({
        grade: s.grade,
        assignment: { weight: a.weight, maxScore: a.maxScore },
      }))
    ),
    course.assignments
  )

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-semibold text-primary">{course.code}</span>
          <span className="text-muted-foreground text-sm">{course.semester}</span>
        </div>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">ผู้สอน: อ.{course.instructor.name}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{weightedScore > 0 ? `${weightedScore.toFixed(1)}%` : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">คะแนนรวมปัจจุบัน</p>
            {weightedScore > 0 && (
              <div className="flex justify-center mt-2">
                <GradeBadge score={weightedScore} maxScore={100} />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{submitted}</p>
            <p className="text-xs text-muted-foreground mt-1">งานที่ส่งแล้ว</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{remaining}</p>
            <p className="text-xs text-muted-foreground mt-1">งานที่เหลือ</p>
          </CardContent>
        </Card>
      </div>

      {/* Submission progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>ความคืบหน้า</span>
          <span>
            {submitted}/{total} ชิ้น
          </span>
        </div>
        <Progress value={total > 0 ? (submitted / total) * 100 : 0} className="h-2" />
      </div>

      {/* Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">งานทั้งหมด</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่องาน</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead className="text-center">น้ำหนัก</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
                <TableHead className="text-center">คะแนน</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {course.assignments.map((a) => {
                const submission = a.submissions[0] ?? null
                const overdue = isPast(a.dueDate)

                let statusDisplay: React.ReactNode
                let actionEl: React.ReactNode

                if (submission) {
                  statusDisplay = <StatusBadge status={submission.status} />
                  actionEl = (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/student/assignments/${a.id}`}>ดูผล</Link>
                    </Button>
                  )
                } else if (overdue && !a.allowLate) {
                  statusDisplay = (
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border-gray-200">
                      เลย deadline
                    </span>
                  )
                  actionEl = (
                    <Button variant="ghost" size="sm" disabled>
                      เลย deadline
                    </Button>
                  )
                } else {
                  statusDisplay = (
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 border-gray-200">
                      ยังไม่ส่ง
                    </span>
                  )
                  actionEl = (
                    <Button variant="default" size="sm" asChild>
                      <Link href={`/dashboard/student/assignments/${a.id}`}>ส่งงาน</Link>
                    </Button>
                  )
                }

                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>
                      <AssignmentTypeBadge type={a.type} />
                    </TableCell>
                    <TableCell className="text-center text-sm">{a.weight}%</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {format(a.dueDate, "d MMM yy HH:mm", { locale: th })}
                        </p>
                        <DeadlineBadge dueDate={a.dueDate} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{statusDisplay}</TableCell>
                    <TableCell className="text-center">
                      {submission?.grade ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-semibold">
                            {submission.grade.score}/{a.maxScore}
                          </span>
                          <GradeBadge score={submission.grade.score} maxScore={a.maxScore} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{actionEl}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
