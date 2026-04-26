import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Download } from "lucide-react"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { calculateWeightedScore } from "@/lib/grade-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { GradeBadge } from "@/components/grade-badge"
import { PrintButton } from "@/components/print-button"

interface Props {
  params: { courseId: string }
}

export default async function CourseReportPage({ params }: Props) {
  const user = await requireRole("INSTRUCTOR")

  const course = await db.course.findFirst({
    where: { id: params.courseId, instructorId: user.id },
    include: {
      assignments: { orderBy: { dueDate: "asc" } },
      enrollments: {
        where: { status: "ACTIVE" },
        include: {
          student: { select: { id: true, name: true, email: true, yearLevel: true } },
        },
        orderBy: { student: { name: "asc" } },
      },
    },
  })

  if (!course) notFound()

  const submissions = await db.submission.findMany({
    where: { assignment: { courseId: params.courseId } },
    include: { grade: { select: { score: true } } },
  })

  const reportRows = course.enrollments.map(({ student }) => {
    const subMap = new Map(
      submissions.filter((s) => s.studentId === student.id).map((s) => [s.assignmentId, s])
    )
    const scores = course.assignments.map((a) => subMap.get(a.id)?.grade?.score ?? null)
    const subsForCalc = course.assignments.map((a) => ({
      grade: subMap.get(a.id)?.grade ?? null,
      assignment: { weight: a.weight, maxScore: a.maxScore },
    }))
    const weighted = calculateWeightedScore(subsForCalc, course.assignments)
    return { student, scores, weighted }
  })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toolbar — hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/dashboard/instructor/courses/${params.courseId}/analytics`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            กลับ Analytics
          </Link>
        </Button>
        <div className="flex gap-2">
          <PrintButton />
          <Button size="sm" asChild>
            <a href={`/api/export/${params.courseId}`} download>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      {/* Report header (visible always, styled for print) */}
      <div>
        <h1 className="text-xl font-bold">
          {course.code} — {course.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {course.semester} · {course.enrollments.length} คน ·{" "}
          {course.assignments.length} งาน
        </p>
      </div>

      {/* Preview table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">รายงานคะแนนทั้งหมด</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background whitespace-nowrap">
                  ชื่อ
                </TableHead>
                <TableHead className="whitespace-nowrap">ชั้นปี</TableHead>
                {course.assignments.map((a) => (
                  <TableHead
                    key={a.id}
                    className="text-center min-w-[72px]"
                  >
                    <div
                      className="truncate max-w-[72px] text-xs"
                      title={a.title}
                    >
                      {a.title}
                    </div>
                    <div className="font-normal text-muted-foreground text-xs">
                      /{a.maxScore}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-center whitespace-nowrap">คะแนนรวม</TableHead>
                <TableHead className="text-center whitespace-nowrap">เกรด</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportRows.map(({ student, scores, weighted }) => (
                <TableRow key={student.id}>
                  <TableCell className="sticky left-0 bg-background">
                    <p className="font-medium text-sm whitespace-nowrap">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </TableCell>
                  <TableCell className="text-sm">{student.yearLevel ?? "—"}</TableCell>
                  {scores.map((score, i) => (
                    <TableCell key={i} className="text-center text-sm">
                      {score !== null ? (
                        score
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-semibold text-sm">
                    {weighted > 0 ? `${weighted.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {weighted > 0 ? (
                      <GradeBadge score={weighted} maxScore={100} />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
