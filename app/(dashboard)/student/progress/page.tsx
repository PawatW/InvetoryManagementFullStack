import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { calculateWeightedScore, getClassStats, scoreToGrade } from "@/lib/grade-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GradeBadge } from "@/components/grade-badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ProgressCharts } from "@/components/progress-charts"
import type { LineDataPoint, BarDataPoint } from "@/components/progress-charts"

const TYPE_LABELS: Record<string, string> = {
  HOMEWORK: "การบ้าน",
  QUIZ: "แบบทดสอบ",
  MIDTERM: "กลางภาค",
  FINAL: "ปลายภาค",
  PROJECT: "โปรเจกต์",
}

export default async function StudentProgressPage() {
  const user = await requireRole("STUDENT")

  const enrollments = await db.enrollment.findMany({
    where: { studentId: user.id, status: "ACTIVE" },
    include: {
      course: {
        include: {
          instructor: { select: { name: true } },
          assignments: {
            include: {
              submissions: {
                include: { grade: true },
              },
            },
            orderBy: { dueDate: "asc" },
          },
        },
      },
    },
  })

  // ── Build Line Chart data ────────────────────────────────────────────
  // All graded submissions sorted by dueDate
  const gradedPoints: LineDataPoint[] = []

  for (const { course } of enrollments) {
    for (const assignment of course.assignments) {
      const mySubmission = assignment.submissions.find((s) => s.studentId === user.id)
      if (!mySubmission?.grade) continue

      // Class average for this assignment (all graded submissions)
      const allGrades = assignment.submissions
        .filter((s) => s.grade)
        .map((s) => (s.grade!.score / assignment.maxScore) * 100)
      const classAvg = allGrades.length > 0
        ? Math.round((allGrades.reduce((s, v) => s + v, 0) / allGrades.length) * 10) / 10
        : null

      gradedPoints.push({
        name: assignment.title.length > 18 ? assignment.title.slice(0, 18) + "…" : assignment.title,
        courseCode: course.code,
        studentScore: Math.round((mySubmission.grade.score / assignment.maxScore) * 1000) / 10,
        classAvg,
      })
    }
  }

  // ── Build Bar Chart data ─────────────────────────────────────────────
  const byType: Record<string, number[]> = {}

  for (const { course } of enrollments) {
    for (const assignment of course.assignments) {
      const mySubmission = assignment.submissions.find((s) => s.studentId === user.id)
      if (!mySubmission?.grade) continue

      const pct = (mySubmission.grade.score / assignment.maxScore) * 100
      if (!byType[assignment.type]) byType[assignment.type] = []
      byType[assignment.type].push(pct)
    }
  }

  const barData: BarDataPoint[] = Object.entries(byType).map(([type, scores]) => ({
    name: TYPE_LABELS[type] ?? type,
    score: Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10,
    count: scores.length,
  }))

  // ── Summary table per course ─────────────────────────────────────────
  const courseSummaries = enrollments.map(({ course }) => {
    const total = course.assignments.length
    const submitted = course.assignments.filter((a) =>
      a.submissions.some((s) => s.studentId === user.id)
    ).length

    const weightedScore = calculateWeightedScore(
      course.assignments.flatMap((a) =>
        a.submissions
          .filter((s) => s.studentId === user.id)
          .map((s) => ({ grade: s.grade, assignment: { weight: a.weight, maxScore: a.maxScore } }))
      ),
      course.assignments
    )

    const myScores = course.assignments.flatMap((a) =>
      a.submissions
        .filter((s) => s.studentId === user.id && s.grade)
        .map((s) => (s.grade!.score / a.maxScore) * 100)
    )
    const stats = getClassStats(myScores)

    return {
      id: course.id,
      code: course.code,
      title: course.title,
      total,
      submitted,
      remaining: total - submitted,
      weightedScore,
      grade: weightedScore > 0 ? scoreToGrade(weightedScore) : "—",
      stats,
    }
  })

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">ความก้าวหน้า</h1>
        <p className="text-muted-foreground text-sm mt-1">ภาพรวมผลการเรียนและคะแนนของคุณ</p>
      </div>

      {/* Charts */}
      <ProgressCharts lineData={gradedPoints} barData={barData} />

      {/* Summary table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">สรุปรายวิชา</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วิชา</TableHead>
                <TableHead className="text-center">ส่งงาน</TableHead>
                <TableHead className="text-center">งานเหลือ</TableHead>
                <TableHead className="text-center">คะแนนรวม</TableHead>
                <TableHead className="text-center">เกรดประมาณ</TableHead>
                <TableHead className="text-center">สูงสุด/ต่ำสุด</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courseSummaries.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-mono text-sm font-semibold">{c.code}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {c.title}
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="space-y-1">
                      <p className="text-sm">
                        {c.submitted}/{c.total}
                      </p>
                      <Progress
                        value={c.total > 0 ? (c.submitted / c.total) * 100 : 0}
                        className="h-1.5 w-16 mx-auto"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {c.remaining > 0 ? (
                      <span className="text-orange-600 font-medium">{c.remaining} ชิ้น</span>
                    ) : (
                      <span className="text-green-600">ครบ</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.weightedScore > 0 ? (
                      <span className="text-sm font-semibold">{c.weightedScore.toFixed(1)}%</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.weightedScore > 0 ? (
                      <GradeBadge score={c.weightedScore} maxScore={100} />
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {c.stats.highest > 0 ? (
                      <span>
                        {c.stats.highest.toFixed(1)}% / {c.stats.lowest.toFixed(1)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {courseSummaries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    ยังไม่มีข้อมูล
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
