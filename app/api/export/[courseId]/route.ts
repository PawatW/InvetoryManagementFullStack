import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { calculateWeightedScore, scoreToGrade } from "@/lib/grade-utils"

export async function GET(
  _req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "INSTRUCTOR") {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const course = await db.course.findFirst({
    where: { id: params.courseId, instructorId: session.user.id },
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

  if (!course) return new NextResponse("Not found", { status: 404 })

  const submissions = await db.submission.findMany({
    where: { assignment: { courseId: params.courseId } },
    include: { grade: { select: { score: true } } },
  })

  function cell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`
  }

  const header = [
    "อีเมล",
    "ชื่อ",
    "ชั้นปี",
    ...course.assignments.map((a) => a.title),
    "คะแนนรวม (%)",
    "เกรด",
  ]

  const dataRows = course.enrollments.map(({ student }) => {
    const subMap = new Map(
      submissions
        .filter((s) => s.studentId === student.id)
        .map((s) => [s.assignmentId, s])
    )

    const scores = course.assignments.map((a) => {
      const sub = subMap.get(a.id)
      return sub?.grade != null ? String(sub.grade.score) : ""
    })

    const subsForCalc = course.assignments.map((a) => ({
      grade: subMap.get(a.id)?.grade ?? null,
      assignment: { weight: a.weight, maxScore: a.maxScore },
    }))

    const weighted = calculateWeightedScore(subsForCalc, course.assignments)
    const grade = weighted > 0 ? scoreToGrade(weighted) : ""

    return [
      student.email,
      student.name,
      student.yearLevel ?? "",
      ...scores,
      weighted > 0 ? weighted.toFixed(1) : "",
      grade,
    ]
  })

  const csv = [header, ...dataRows]
    .map((row) => row.map(cell).join(","))
    .join("\r\n")

  const safeSemester = course.semester.replace(/\//g, "-")
  const filename = `${course.code}_${safeSemester}_report.csv`

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  })
}
