import Link from "next/link"
import { BookOpen } from "lucide-react"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { calculateWeightedScore, scoreToGrade } from "@/lib/grade-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { GradeBadge } from "@/components/grade-badge"

export default async function StudentCoursesPage() {
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
                where: { studentId: user.id },
                include: { grade: true },
              },
            },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">วิชาที่เรียน</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {enrollments.length} รายวิชา ภาคการศึกษา 1/2567
        </p>
      </div>

      {enrollments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">ยังไม่ได้ลงทะเบียนในวิชาใด</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {enrollments.map(({ course }) => {
            const total = course.assignments.length
            const submitted = course.assignments.filter((a) => a.submissions.length > 0).length
            const progressPct = total > 0 ? (submitted / total) * 100 : 0

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
              <Link key={course.id} href={`/dashboard/student/courses/${course.id}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-primary">
                        {course.code}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">{course.semester}</span>
                    </div>
                    <CardTitle className="text-base leading-tight group-hover:text-primary transition-colors">
                      {course.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">อ.{course.instructor.name}</p>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>งานที่ส่ง</span>
                        <span>
                          {submitted}/{total} ชิ้น
                        </span>
                      </div>
                      <Progress value={progressPct} className="h-1.5" />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">คะแนนรวม</span>
                      <div className="flex items-center gap-2">
                        {weightedScore > 0 ? (
                          <>
                            <span className="text-sm font-semibold">
                              {weightedScore.toFixed(1)}%
                            </span>
                            <GradeBadge score={weightedScore} maxScore={100} />
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">ยังไม่มีคะแนน</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
