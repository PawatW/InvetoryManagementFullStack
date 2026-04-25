import Link from "next/link"
import { addDays, format, isPast } from "date-fns"
import { th } from "date-fns/locale"
import { BookOpen, ClipboardCheck, ClipboardList, TrendingUp } from "lucide-react"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { calculateWeightedScore } from "@/lib/grade-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DeadlineBadge } from "@/components/deadline-badge"
import { StatusBadge } from "@/components/status-badge"
import { AssignmentTypeBadge } from "@/components/assignment-type-badge"

export default async function StudentDashboard() {
  const user = await requireRole("STUDENT")

  const enrollments = await db.enrollment.findMany({
    where: { studentId: user.id, status: "ACTIVE" },
    include: {
      course: {
        include: {
          assignments: {
            include: {
              submissions: {
                where: { studentId: user.id },
                include: { grade: true },
              },
            },
          },
        },
      },
    },
  })

  const now = new Date()
  const sevenDaysLater = addDays(now, 7)

  // Flatten all assignments across all courses
  const allAssignments = enrollments.flatMap((e) =>
    e.course.assignments.map((a) => ({ ...a, courseCode: e.course.code, courseTitle: e.course.title }))
  )

  // Upcoming assignments: due within 7 days, not submitted
  const upcoming = allAssignments
    .filter((a) => {
      const hasSubmission = a.submissions.length > 0
      return !hasSubmission && a.dueDate >= now && a.dueDate <= sevenDaysLater
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

  // Recent graded: last 5
  const recentGraded = allAssignments
    .flatMap((a) =>
      a.submissions
        .filter((s) => s.grade)
        .map((s) => ({ ...s, assignmentTitle: a.title, maxScore: a.maxScore, courseCode: a.courseCode }))
    )
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
    .slice(0, 5)

  // Summary counts
  const totalCourses = enrollments.length
  const totalSubmitted = allAssignments.reduce((s, a) => s + a.submissions.length, 0)
  const totalPending = allAssignments.filter(
    (a) => a.submissions.length === 0 && !isPast(a.dueDate)
  ).length

  // Weighted average across all courses
  const allSubmissionsForAvg = allAssignments.flatMap((a) =>
    a.submissions.map((s) => ({ grade: s.grade, assignment: { weight: a.weight, maxScore: a.maxScore } }))
  )
  const allAssignmentsForWeight = allAssignments.map((a) => ({ weight: a.weight }))
  const overallAvg =
    allAssignmentsForWeight.length > 0
      ? calculateWeightedScore(allSubmissionsForAvg, allAssignmentsForWeight)
      : 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">สวัสดี, {user.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          ภาคการศึกษา 1/2567 — {format(now, "d MMMM yyyy", { locale: th })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">วิชาที่เรียน</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCourses}</p>
            <p className="text-xs text-muted-foreground mt-1">รายวิชา</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">งานที่ต้องส่ง</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{totalPending}</p>
            <p className="text-xs text-muted-foreground mt-1">ชิ้น</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ส่งแล้ว</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{totalSubmitted}</p>
            <p className="text-xs text-muted-foreground mt-1">ชิ้น</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">คะแนนเฉลี่ย</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{overallAvg > 0 ? `${overallAvg.toFixed(1)}%` : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">รวมทุกวิชา</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">งานใกล้ Deadline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                ไม่มีงานที่ต้องส่งใน 7 วันข้างหน้า
              </p>
            ) : (
              upcoming.map((a) => (
                <Link
                  key={a.id}
                  href={`/dashboard/student/assignments/${a.id}`}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{a.courseCode}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <DeadlineBadge dueDate={a.dueDate} />
                    <AssignmentTypeBadge type={a.type} />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ผลงานล่าสุด</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentGraded.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                ยังไม่มีงานที่ตรวจแล้ว
              </p>
            ) : (
              recentGraded.map((s) => {
                const pct = s.grade ? (s.grade.score / s.maxScore) * 100 : 0
                return (
                  <div key={s.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.assignmentTitle}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.courseCode}</p>
                      </div>
                      <span className="text-sm font-semibold shrink-0">
                        {s.grade?.score}/{s.maxScore}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
