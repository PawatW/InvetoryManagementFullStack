import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { calculateWeightedScore, scoreToGrade, scoreToGradeColor } from "@/lib/grade-utils"
import { getTrendData } from "@/lib/chart-utils"
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
import { ScoreTrendChart } from "@/components/score-trend-chart"
import { RadarPerformanceChart, type RadarPoint } from "@/components/radar-performance-chart"
import { cn } from "@/lib/utils"

const TYPE_LABELS: Record<string, string> = {
  HOMEWORK: "การบ้าน",
  QUIZ: "แบบทดสอบ",
  MIDTERM: "กลางภาค",
  FINAL: "ปลายภาค",
  PROJECT: "โปรเจกต์",
}

const ALL_TYPES = ["HOMEWORK", "QUIZ", "MIDTERM", "FINAL", "PROJECT"]

function scoreToGradePoints(score: number): number {
  if (score >= 80) return 4.0
  if (score >= 75) return 3.5
  if (score >= 70) return 3.0
  if (score >= 65) return 2.5
  if (score >= 60) return 2.0
  if (score >= 55) return 1.5
  if (score >= 50) return 1.0
  return 0.0
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
                include: { grade: { select: { score: true } } },
              },
            },
            orderBy: { dueDate: "asc" },
          },
        },
      },
    },
  })

  // ── Personal stats ───────────────────────────────────────────────────
  let totalSubmitted = 0
  let totalAssignmentsAll = 0

  for (const { course } of enrollments) {
    for (const a of course.assignments) {
      totalAssignmentsAll++
      if (a.submissions.some((s) => s.studentId === user.id)) totalSubmitted++
    }
  }

  const totalMissing = totalAssignmentsAll - totalSubmitted
  const submissionRate =
    totalAssignmentsAll > 0
      ? Math.round((totalSubmitted / totalAssignmentsAll) * 1000) / 10
      : 0

  // ── Course summaries ─────────────────────────────────────────────────
  const courseSummaries = enrollments.map(({ course }) => {
    const totalA = course.assignments.length
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

    // Projection: score needed on remaining work to reach A (80%)
    let currentPts = 0
    let gradedWeight = 0
    const totalWeight = course.assignments.reduce((s, a) => s + a.weight, 0)
    for (const a of course.assignments) {
      const mySub = a.submissions.find((s) => s.studentId === user.id)
      if (mySub?.grade) {
        currentPts += (mySub.grade.score / a.maxScore) * 100 * a.weight
        gradedWeight += a.weight
      }
    }
    const remainingWeight = totalWeight - gradedWeight
    const neededRaw =
      remainingWeight > 0 ? (80 * totalWeight - currentPts) / remainingWeight : null

    let needForA: string
    if (neededRaw === null) {
      needForA = weightedScore >= 80 ? "ได้แล้ว ✓" : "ไม่สามารถ"
    } else if (neededRaw > 100) {
      needForA = "เป็นไปไม่ได้"
    } else if (neededRaw <= 0) {
      needForA = "ได้แล้ว ✓"
    } else {
      needForA = `≥ ${Math.round(neededRaw * 10) / 10}%`
    }

    return {
      id: course.id,
      code: course.code,
      title: course.title,
      total: totalA,
      submitted,
      remaining: totalA - submitted,
      weightedScore,
      grade: weightedScore > 0 ? scoreToGrade(weightedScore) : null,
      needForA,
      achievableA: neededRaw === null ? weightedScore >= 80 : neededRaw <= 100,
    }
  })

  // Approximate GPA from courses with ≥1 graded assignment
  const gradedCourses = courseSummaries.filter((c) => c.weightedScore > 0)
  const gpaApprox =
    gradedCourses.length > 0
      ? Math.round(
          (gradedCourses.reduce((s, c) => s + scoreToGradePoints(c.weightedScore), 0) /
            gradedCourses.length) *
            100
        ) / 100
      : null

  // ── Score Trend data ─────────────────────────────────────────────────
  const classAvgMap = new Map<string, number>()
  for (const { course } of enrollments) {
    for (const a of course.assignments) {
      const allGrades = a.submissions
        .filter((s) => s.grade)
        .map((s) => (s.grade!.score / a.maxScore) * 100)
      if (allGrades.length > 0) {
        classAvgMap.set(
          a.id,
          Math.round((allGrades.reduce((s, v) => s + v, 0) / allGrades.length) * 10) / 10
        )
      }
    }
  }

  const trendRaw: Array<{
    score: number
    maxScore: number
    title: string
    assignmentId: string
    dueDate: Date
  }> = []
  for (const { course } of enrollments) {
    for (const a of course.assignments) {
      const mySub = a.submissions.find((s) => s.studentId === user.id)
      if (!mySub?.grade) continue
      trendRaw.push({
        score: mySub.grade.score,
        maxScore: a.maxScore,
        title: a.title,
        assignmentId: a.id,
        dueDate: a.dueDate,
      })
    }
  }
  trendRaw.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

  const trendData = getTrendData(
    trendRaw.map(({ dueDate: _d, ...rest }) => rest),
    classAvgMap
  )

  // ── Radar data (by assignment type) ─────────────────────────────────
  const byType: Record<string, number[]> = {}
  for (const { course } of enrollments) {
    for (const a of course.assignments) {
      const mySub = a.submissions.find((s) => s.studentId === user.id)
      if (!mySub?.grade) continue
      const pct = (mySub.grade.score / a.maxScore) * 100
      if (!byType[a.type]) byType[a.type] = []
      byType[a.type].push(pct)
    }
  }

  const radarData: RadarPoint[] = ALL_TYPES.map((type) => {
    const scores = byType[type] ?? []
    return {
      type: TYPE_LABELS[type],
      score:
        scores.length > 0
          ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
          : 0,
    }
  })

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">ความก้าวหน้า</h1>
        <p className="text-muted-foreground text-sm mt-1">ภาพรวมผลการเรียนและคะแนนของคุณ</p>
      </div>

      {/* Section 1 — Personal Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            {gpaApprox !== null ? (
              <>
                <p
                  className={cn(
                    "text-3xl font-bold",
                    scoreToGradeColor(gpaApprox * 25) // rough scale 4→100
                  )}
                >
                  {gpaApprox.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">ประมาณ GPA</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-1">ประมาณ GPA</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{totalSubmitted}</p>
            <p className="text-xs text-muted-foreground mt-1">งานส่งทั้งหมด</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className={cn("text-3xl font-bold", totalMissing > 0 ? "text-red-600" : "text-green-600")}>
              {totalMissing}
            </p>
            <p className="text-xs text-muted-foreground mt-1">งานขาดส่ง</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-purple-600">{submissionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Submission rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Section 2 & 3 — Trend + Radar side-by-side on lg */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">แนวโน้มคะแนน</CardTitle>
            <p className="text-xs text-muted-foreground">
              คะแนนของฉัน (สีน้ำเงิน) vs ค่าเฉลี่ยชั้น (สีเทา) เรียงตามวันกำหนดส่ง
            </p>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart data={trendData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">คะแนนตามประเภทงาน</CardTitle>
            <p className="text-xs text-muted-foreground">
              ค่าเฉลี่ย % ของแต่ละประเภทจากงานที่ตรวจแล้ว
            </p>
          </CardHeader>
          <CardContent>
            <RadarPerformanceChart data={radarData} />
          </CardContent>
        </Card>
      </div>

      {/* Section 4 — Course Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">สรุปรายวิชา</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วิชา</TableHead>
                <TableHead className="text-center">คะแนนรวม</TableHead>
                <TableHead className="text-center">ประมาณเกรด</TableHead>
                <TableHead className="text-center">งานที่เหลือ</TableHead>
                <TableHead className="text-center">ต้องทำเพื่อได้ A</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courseSummaries.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-mono text-sm font-semibold">{c.code}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {c.title}
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    {c.weightedScore > 0 ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{c.weightedScore.toFixed(1)}%</p>
                        <Progress value={c.weightedScore} className="h-1.5 w-20 mx-auto" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.grade ? (
                      <GradeBadge score={c.weightedScore} maxScore={100} />
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {c.remaining > 0 ? (
                      <span className="text-orange-600 font-medium">{c.remaining} ชิ้น</span>
                    ) : (
                      <span className="text-green-600">ครบ</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        c.needForA === "ได้แล้ว ✓" && "text-green-600",
                        (c.needForA === "ไม่สามารถ" || c.needForA === "เป็นไปไม่ได้") &&
                          "text-red-500",
                        c.needForA.startsWith("≥") && "text-blue-600"
                      )}
                    >
                      {c.needForA}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {courseSummaries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
