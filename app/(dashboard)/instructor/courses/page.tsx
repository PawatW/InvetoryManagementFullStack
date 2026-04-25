import Link from "next/link"
import { BookOpen, Users, ClipboardList } from "lucide-react"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default async function InstructorCoursesPage() {
  const user = await requireRole("INSTRUCTOR")

  const courses = await db.course.findMany({
    where: { instructorId: user.id },
    include: {
      enrollments: { where: { status: "ACTIVE" } },
      assignments: {
        include: {
          submissions: { where: { status: { in: ["SUBMITTED", "LATE"] } } },
        },
      },
    },
    orderBy: [{ year: "desc" }, { semester: "asc" }],
  })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">วิชาของฉัน</h1>
        <p className="text-muted-foreground text-sm mt-1">รายวิชาทั้งหมดที่คุณเป็นผู้สอน</p>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">ยังไม่มีวิชาที่สอน</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((course) => {
            const pendingCount = course.assignments.reduce(
              (s, a) => s + a.submissions.length,
              0
            )
            return (
              <Link key={course.id} href={`/dashboard/instructor/courses/${course.id}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-primary">
                        {course.code}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {course.semester}
                      </span>
                    </div>
                    <CardTitle className="text-base leading-tight group-hover:text-primary transition-colors">
                      {course.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {course.enrollments.length} คน
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5" />
                        {course.assignments.length} งาน
                      </span>
                    </div>
                    {pendingCount > 0 && (
                      <Badge variant="warning" className="w-fit">
                        รอตรวจ {pendingCount} ชิ้น
                      </Badge>
                    )}
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
