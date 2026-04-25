import { notFound } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { th } from "date-fns/locale"
import { Plus, Eye } from "lucide-react"

import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AssignmentTypeBadge } from "@/components/assignment-type-badge"
import { DeadlineBadge } from "@/components/deadline-badge"
import { GradeBadge } from "@/components/grade-badge"
import { calculateWeightedScore, scoreToGrade } from "@/lib/grade-utils"

interface Props {
  params: { courseId: string }
}

export default async function CourseDetailPage({ params }: Props) {
  const user = await requireRole("INSTRUCTOR")

  const course = await db.course.findFirst({
    where: { id: params.courseId, instructorId: user.id },
    include: {
      assignments: {
        include: {
          submissions: {
            include: { grade: true },
          },
        },
        orderBy: { dueDate: "asc" },
      },
      enrollments: {
        where: { status: "ACTIVE" },
        include: {
          student: {
            include: {
              submissions: {
                where: {
                  assignment: { courseId: params.courseId },
                },
                include: {
                  grade: true,
                  assignment: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!course) notFound()

  const totalEnrolled = course.enrollments.length

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-primary">{course.code}</span>
            <span className="text-muted-foreground text-sm">{course.semester}</span>
          </div>
          <h1 className="text-2xl font-bold">{course.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalEnrolled} นักศึกษาลงทะเบียน
          </p>
        </div>
      </div>

      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments">งานทั้งหมด ({course.assignments.length})</TabsTrigger>
          <TabsTrigger value="students">นักศึกษา ({totalEnrolled})</TabsTrigger>
        </TabsList>

        {/* ── Tab: Assignments ── */}
        <TabsContent value="assignments" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button asChild>
              <Link href={`/dashboard/instructor/courses/${course.id}/assignments/new`}>
                <Plus className="h-4 w-4 mr-2" />
                สร้างงานใหม่
              </Link>
            </Button>
          </div>

          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่องาน</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-center">น้ำหนัก</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="text-center">ส่งแล้ว / ทั้งหมด</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {course.assignments.map((a) => {
                  const submitted = a.submissions.length
                  const pending = a.submissions.filter(
                    (s) => s.status === "SUBMITTED" || s.status === "LATE"
                  ).length
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>
                        <AssignmentTypeBadge type={a.type} />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium">{a.weight}%</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {format(a.dueDate, "d MMM yy HH:mm", { locale: th })}
                          </p>
                          <DeadlineBadge dueDate={a.dueDate} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">
                          {submitted}/{totalEnrolled}
                        </span>
                        {pending > 0 && (
                          <Badge variant="warning" className="ml-2 text-xs">
                            รอตรวจ {pending}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/instructor/assignments/${a.id}/edit`}>
                              แก้ไข
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/instructor/assignments/${a.id}/submissions`}>
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              ดูผลงาน
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {course.assignments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      ยังไม่มีงาน — กดปุ่ม "สร้างงานใหม่" เพื่อเพิ่ม
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Tab: Students ── */}
        <TabsContent value="students" className="mt-4">
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ-สกุล</TableHead>
                  <TableHead>ชั้นปี</TableHead>
                  <TableHead className="text-center">งานที่ส่ง / ทั้งหมด</TableHead>
                  <TableHead className="text-center">คะแนนรวม</TableHead>
                  <TableHead className="text-center">เกรดประมาณ</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {course.enrollments.map(({ student }) => {
                  const submitted = student.submissions.length
                  const total = course.assignments.length
                  const weightedScore = calculateWeightedScore(
                    student.submissions.map((s) => ({
                      grade: s.grade,
                      assignment: s.assignment,
                    })),
                    course.assignments
                  )
                  const grade = scoreToGrade(weightedScore)

                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/instructor/courses/${course.id}/students/${student.id}`}
                          className="font-medium hover:underline"
                        >
                          {student.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{student.email}</p>
                      </TableCell>
                      <TableCell className="text-sm">{student.yearLevel ?? "—"}</TableCell>
                      <TableCell className="text-center text-sm">
                        {submitted}/{total}
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">
                        {weightedScore > 0 ? `${weightedScore.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {weightedScore > 0 ? (
                          <GradeBadge score={weightedScore} maxScore={100} />
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`/dashboard/instructor/courses/${course.id}/students/${student.id}`}
                          >
                            รายละเอียด
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {course.enrollments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      ยังไม่มีนักศึกษาลงทะเบียน
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
