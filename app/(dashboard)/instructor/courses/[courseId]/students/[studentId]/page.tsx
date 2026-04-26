import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { calculateWeightedScore, scoreToGrade, scoreToGradeColor } from "@/lib/grade-utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AssignmentTypeBadge } from "@/components/assignment-type-badge"
import { StatusBadge } from "@/components/status-badge"
import { GradeBadge } from "@/components/grade-badge"
import { cn } from "@/lib/utils"

interface Props {
  params: { courseId: string; studentId: string }
}

const GRADE_THRESHOLDS = [
  { label: "A", min: 80 },
  { label: "B+", min: 75 },
  { label: "B", min: 70 },
  { label: "C+", min: 65 },
  { label: "C", min: 60 },
]

export default async function StudentGradeSummaryPage({ params }: Props) {
  const user = await requireRole("INSTRUCTOR")

  const course = await db.course.findFirst({
    where: { id: params.courseId, instructorId: user.id },
    include: {
      assignments: {
        include: {
          submissions: {
            where: { studentId: params.studentId },
            include: { grade: true },
          },
        },
        orderBy: { dueDate: "asc" },
      },
    },
  })
  if (!course) notFound()

  const student = await db.user.findUnique({
    where: { id: params.studentId },
    select: { id: true, name: true, email: true, yearLevel: true },
  })

  const enrollment = await db.enrollment.findFirst({
    where: { studentId: params.studentId, courseId: params.courseId },
  })

  if (!student || !enrollment) notFound()

  // Weighted score calculation
  const submissionsForCalc = course.assignments.flatMap((a) =>
    a.submissions.map((s) => ({
      grade: s.grade,
      assignment: { weight: a.weight, maxScore: a.maxScore },
    }))
  )
  const weightedScore = calculateWeightedScore(submissionsForCalc, course.assignments)

  const totalWeight = course.assignments.reduce((s, a) => s + a.weight, 0)
  const gradedWeight = course.assignments
    .filter((a) => a.submissions[0]?.grade)
    .reduce((s, a) => s + a.weight, 0)
  const remainingWeight = totalWeight - gradedWeight

  // Current contribution in "weighted points"
  let currentPts = 0
  for (const a of course.assignments) {
    const sub = a.submissions[0]
    if (sub?.grade) {
      currentPts += (sub.grade.score / a.maxScore) * 100 * a.weight
    }
  }

  // Grade projections
  const projections = GRADE_THRESHOLDS.map(({ label, min }) => {
    if (remainingWeight === 0) return { label, needed: null, achievable: weightedScore >= min }
    const needed = ((min * totalWeight - currentPts) / remainingWeight)
    return { label, needed: Math.round(needed * 10) / 10, achievable: needed <= 100 }
  })

  const initials = student.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const letterGrade = weightedScore > 0 ? scoreToGrade(weightedScore) : null
  const gradeColor = weightedScore > 0 ? scoreToGradeColor(weightedScore) : ""

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Back */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/dashboard/instructor/courses/${params.courseId}?tab=students`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            กลับ
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/instructor/courses/${params.courseId}`}>ดูงานทั้งหมด</Link>
        </Button>
      </div>

      {/* Student header */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-5">
            <Avatar className="h-16 w-16 text-xl shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{student.name}</h1>
              <p className="text-sm text-muted-foreground">{student.email}</p>
              {student.yearLevel && (
                <p className="text-sm text-muted-foreground">{student.yearLevel}</p>
              )}
            </div>
            <div className="text-center shrink-0">
              {weightedScore > 0 ? (
                <>
                  <p className={cn("text-4xl font-bold", gradeColor)}>{letterGrade}</p>
                  <p className="text-lg font-semibold mt-1">{weightedScore.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">คะแนนรวมปัจจุบัน</p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">ยังไม่มีคะแนน</p>
              )}
            </div>
          </div>

          {weightedScore > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>ความคืบหน้า ({gradedWeight}/{totalWeight}% น้ำหนักที่ตรวจแล้ว)</span>
                <span>{weightedScore.toFixed(1)}%</span>
              </div>
              <Progress value={weightedScore} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignments table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดคะแนนแต่ละงาน</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่องาน</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead className="text-center">น้ำหนัก%</TableHead>
                <TableHead className="text-center">คะแนนที่ได้</TableHead>
                <TableHead className="text-center">Weighted</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {course.assignments.map((a) => {
                const sub = a.submissions[0] ?? null
                const grade = sub?.grade ?? null
                const scorePct = grade ? (grade.score / a.maxScore) * 100 : null
                const weighted = scorePct !== null ? (scorePct * a.weight) / 100 : null

                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-sm">{a.title}</TableCell>
                    <TableCell>
                      <AssignmentTypeBadge type={a.type} />
                    </TableCell>
                    <TableCell className="text-center text-sm">{a.weight}%</TableCell>
                    <TableCell className="text-center">
                      {grade ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-semibold">
                            {grade.score}/{a.maxScore}
                          </span>
                          <GradeBadge score={grade.score} maxScore={a.maxScore} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {weighted !== null ? (
                        <span className="font-medium">{weighted.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {sub ? (
                        <StatusBadge status={sub.status} />
                      ) : (
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border-gray-200">
                          ยังไม่ส่ง
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">
                  Weighted Average
                </TableCell>
                <TableCell className="text-center font-bold text-base">
                  {weightedScore > 0 ? weightedScore.toFixed(2) : "—"}
                </TableCell>
                <TableCell className="text-center">
                  {letterGrade && <GradeBadge score={weightedScore} maxScore={100} />}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Grade projection */}
      {remainingWeight > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">คาดการณ์เกรด</CardTitle>
            <p className="text-xs text-muted-foreground">
              คะแนนเฉลี่ยที่ต้องได้จากงานที่เหลือ (น้ำหนักรวม {remainingWeight}%)
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {projections.map((p) => (
                <div
                  key={p.label}
                  className={cn(
                    "rounded-lg border p-3 text-center",
                    p.achievable ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50 opacity-60"
                  )}
                >
                  <p className="text-lg font-bold">{p.label}</p>
                  {p.needed !== null ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      ต้องได้ ≥ {p.needed}%
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.achievable ? "ได้แล้ว" : "ไม่ผ่าน"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
