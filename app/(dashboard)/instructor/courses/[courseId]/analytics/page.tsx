import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, AlertTriangle, FileBarChart } from "lucide-react"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { calculateWeightedScore, getClassStats } from "@/lib/grade-utils"
import { getScoreDistribution, getCompletionRate } from "@/lib/chart-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScoreDistributionChart } from "@/components/score-distribution-chart"
import { CompletionRateChart } from "@/components/completion-rate-chart"
import { StudentPerformanceTable, type StudentPerfRow } from "@/components/student-performance-table"

interface Props {
  params: { courseId: string }
}

export default async function CourseAnalyticsPage({ params }: Props) {
  const user = await requireRole("INSTRUCTOR")

  const course = await db.course.findFirst({
    where: { id: params.courseId, instructorId: user.id },
    include: {
      assignments: {
        include: {
          submissions: { include: { grade: { select: { score: true } } } },
        },
        orderBy: { dueDate: "asc" },
      },
      enrollments: {
        where: { status: "ACTIVE" },
        include: {
          student: { select: { id: true, name: true, email: true, yearLevel: true } },
        },
      },
    },
  })

  if (!course) notFound()

  const totalStudents = course.enrollments.length
  const totalAssignments = course.assignments.length

  // Flat submission list (for completion chart and per-student lookup)
  const allSubmissions = course.assignments.flatMap((a) =>
    a.submissions.map((s) => ({
      assignmentId: s.assignmentId,
      isLate: s.isLate,
      studentId: s.studentId,
    }))
  )

  // Per-student rows
  const studentRows: StudentPerfRow[] = course.enrollments.map(({ student }) => {
    const subsForCalc = course.assignments.map((a) => {
      const sub = a.submissions.find((s) => s.studentId === student.id)
      return {
        grade: sub?.grade ?? null,
        assignment: { weight: a.weight, maxScore: a.maxScore },
      }
    })
    const weightedScore = calculateWeightedScore(subsForCalc, course.assignments)
    const submitted = allSubmissions.filter((s) => s.studentId === student.id).length
    return {
      studentId: student.id,
      name: student.name,
      email: student.email,
      yearLevel: student.yearLevel,
      weightedScore,
      submitted,
      total: totalAssignments,
      missing: totalAssignments - submitted,
    }
  })

  // Class stats (only students with ≥1 graded assignment)
  const gradedScores = studentRows.filter((r) => r.weightedScore > 0).map((r) => r.weightedScore)
  const classStats = getClassStats(gradedScores)
  const distribution = getScoreDistribution(gradedScores)

  // Submission rate
  const totalPossible = totalStudents * totalAssignments
  const submissionRate =
    totalPossible > 0
      ? Math.round((allSubmissions.length / totalPossible) * 1000) / 10
      : 0

  // At-risk: missing ≥ 2 OR weighted score < 50%
  const atRisk = studentRows.filter(
    (r) => r.missing >= 2 || (r.weightedScore > 0 && r.weightedScore < 50)
  )

  // Completion chart data
  const completionData = getCompletionRate(
    course.assignments.map((a) => ({ id: a.id, title: a.title })),
    allSubmissions,
    totalStudents
  )

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Back */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/dashboard/instructor/courses/${params.courseId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            กลับ
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/instructor/courses/${params.courseId}/report`}>
            <FileBarChart className="h-4 w-4 mr-1" />
            ดูรายงาน / Export CSV
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">วิเคราะห์ผลการเรียน</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {course.code} · {totalStudents} คน · {totalAssignments} งาน
        </p>
      </div>

      {/* Section 1 — Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-blue-600">
              {classStats.mean > 0 ? `${classStats.mean.toFixed(1)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">คะแนนเฉลี่ย</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-lg font-bold text-green-600">
              {classStats.highest > 0 ? `${classStats.highest.toFixed(1)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {classStats.lowest > 0 ? `ต่ำสุด ${classStats.lowest.toFixed(1)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">สูงสุด / ต่ำสุด</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-purple-600">{submissionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">อัตราการส่งงาน</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-red-600">{atRisk.length}</p>
            <p className="text-xs text-muted-foreground mt-1">นักศึกษาเสี่ยงตก</p>
          </CardContent>
        </Card>
      </div>

      {/* Section 2 — Score Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">การกระจายคะแนน</CardTitle>
          <p className="text-xs text-muted-foreground">
            {gradedScores.length} คน · เฉลี่ย {classStats.mean.toFixed(1)}% · SD{" "}
            {classStats.stdDev.toFixed(1)}
          </p>
        </CardHeader>
        <CardContent>
          {gradedScores.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              ยังไม่มีข้อมูลคะแนน
            </div>
          ) : (
            <ScoreDistributionChart data={distribution} mean={classStats.mean} />
          )}
        </CardContent>
      </Card>

      {/* Section 3 — Assignment Completion Rate */}
      {totalAssignments > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">อัตราการส่งงานรายชิ้น</CardTitle>
            <p className="text-xs text-muted-foreground">
              นักศึกษาทั้งหมด {totalStudents} คน
            </p>
          </CardHeader>
          <CardContent>
            <CompletionRateChart data={completionData} />
          </CardContent>
        </Card>
      )}

      {/* Section 4 — Student Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ผลการเรียนรายคน</CardTitle>
          <p className="text-xs text-muted-foreground">คลิกหัวคอลัมน์เพื่อเรียงลำดับ</p>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <StudentPerformanceTable rows={studentRows} courseId={params.courseId} />
        </CardContent>
      </Card>

      {/* Section 5 — At-Risk Alert Panel */}
      {atRisk.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              นักศึกษาเสี่ยงตก ({atRisk.length} คน)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {atRisk.map((s) => {
                const problems: string[] = []
                if (s.missing >= 2) problems.push(`ขาดส่ง ${s.missing} ชิ้น`)
                if (s.weightedScore > 0 && s.weightedScore < 50)
                  problems.push(`คะแนน ${s.weightedScore.toFixed(1)}%`)
                return (
                  <div
                    key={s.studentId}
                    className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                        {problems.join(" · ")}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="ml-3 shrink-0" asChild>
                      <Link
                        href={`/dashboard/instructor/courses/${params.courseId}/students/${s.studentId}`}
                      >
                        ดูรายละเอียด
                      </Link>
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
