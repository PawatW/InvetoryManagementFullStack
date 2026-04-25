import Link from "next/link"
import { addDays, format, isPast } from "date-fns"
import { th } from "date-fns/locale"
import { BookOpen, Users, ClipboardList, AlertTriangle, ArrowRight } from "lucide-react"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
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
import { Badge } from "@/components/ui/badge"
import { DeadlineBadge } from "@/components/deadline-badge"
import { AssignmentTypeBadge } from "@/components/assignment-type-badge"

export default async function InstructorDashboard() {
  const user = await requireRole("INSTRUCTOR")

  const courses = await db.course.findMany({
    where: { instructorId: user.id },
    include: {
      enrollments: { where: { status: "ACTIVE" } },
      assignments: {
        include: {
          submissions: {
            where: { status: { in: ["SUBMITTED", "LATE"] } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const now = new Date()
  const threeDaysLater = addDays(now, 3)

  const totalStudents = new Set(
    courses.flatMap((c) => c.enrollments.map((e) => e.studentId))
  ).size

  const pendingReview = courses.reduce(
    (sum, c) => sum + c.assignments.reduce((s, a) => s + a.submissions.length, 0),
    0
  )

  const pastDeadlineCount = courses.reduce(
    (sum, c) => sum + c.assignments.filter((a) => isPast(a.dueDate)).length,
    0
  )

  const urgentAssignments = await db.assignment.findMany({
    where: {
      course: { instructorId: user.id },
      dueDate: { gte: now, lte: threeDaysLater },
      submissions: { some: { status: { in: ["SUBMITTED", "LATE"] } } },
    },
    include: {
      course: { select: { code: true, title: true } },
      submissions: { where: { status: { in: ["SUBMITTED", "LATE"] } } },
    },
    orderBy: { dueDate: "asc" },
  })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">สวัสดี, {user.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          ภาคการศึกษา 1/2567 — ข้อมูล ณ {format(now, "d MMMM yyyy", { locale: th })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">วิชาที่สอน</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{courses.length}</p>
            <p className="text-xs text-muted-foreground mt-1">รายวิชา</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">งานรอตรวจ</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{pendingReview}</p>
            <p className="text-xs text-muted-foreground mt-1">ชิ้นงาน</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">นักศึกษาทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalStudents}</p>
            <p className="text-xs text-muted-foreground mt-1">คน</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">เลย Deadline</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{pastDeadlineCount}</p>
            <p className="text-xs text-muted-foreground mt-1">งาน</p>
          </CardContent>
        </Card>
      </div>

      {/* Course Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>รายวิชาที่สอน</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/instructor/courses">ดูทั้งหมด</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัสวิชา</TableHead>
                <TableHead>ชื่อวิชา</TableHead>
                <TableHead className="text-center">นักศึกษา</TableHead>
                <TableHead className="text-center">งานรอตรวจ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => {
                const pending = course.assignments.reduce(
                  (s, a) => s + a.submissions.length,
                  0
                )
                return (
                  <TableRow key={course.id}>
                    <TableCell className="font-mono font-medium">{course.code}</TableCell>
                    <TableCell>{course.title}</TableCell>
                    <TableCell className="text-center">{course.enrollments.length}</TableCell>
                    <TableCell className="text-center">
                      {pending > 0 ? (
                        <Badge variant="warning">{pending} ชิ้น</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/instructor/courses/${course.id}`}>
                          จัดการ <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {courses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    ยังไม่มีวิชาที่สอน
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Urgent assignments */}
      {urgentAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              งานที่ต้องตรวจด่วน
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>งาน</TableHead>
                  <TableHead>วิชา</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-center">รอตรวจ</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {urgentAssignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {a.course.code}
                    </TableCell>
                    <TableCell>
                      <AssignmentTypeBadge type={a.type} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">{a.submissions.length} ชิ้น</Badge>
                    </TableCell>
                    <TableCell>
                      <DeadlineBadge dueDate={a.dueDate} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/instructor/assignments/${a.id}/submissions`}>
                          ตรวจงาน
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
