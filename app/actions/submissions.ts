"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { db } from "@/lib/db"

const submitSchema = z.object({
  fileName: z.string().min(1, "กรุณาระบุชื่อไฟล์"),
  studentNote: z.string().optional(),
})

type SubmitInput = z.infer<typeof submitSchema>

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function getStudentSession() {
  const session = await auth()
  if (!session?.user || session.user.role !== "STUDENT") return null
  return session.user
}

export async function submitAssignment(
  assignmentId: string,
  data: SubmitInput
): Promise<ActionResult<{ id: string; isLate: boolean }>> {
  const student = await getStudentSession()
  if (!student) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" }

  const parsed = submitSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.data ?? "ข้อมูลไม่ถูกต้อง" }
  }

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, courseId: true, dueDate: true, allowLate: true },
  })
  if (!assignment) return { success: false, error: "ไม่พบงานที่กำหนด" }

  const enrollment = await db.enrollment.findFirst({
    where: { studentId: student.id, courseId: assignment.courseId, status: "ACTIVE" },
  })
  if (!enrollment) return { success: false, error: "ไม่ได้ลงทะเบียนในวิชานี้" }

  const now = new Date()
  const isLate = now > assignment.dueDate

  if (isLate && !assignment.allowLate) {
    return { success: false, error: "เลยกำหนดส่งแล้ว และวิชานี้ไม่อนุญาตให้ส่งช้า" }
  }

  const submission = await db.submission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
    create: {
      assignmentId,
      studentId: student.id,
      fileName: parsed.data.fileName,
      studentNote: parsed.data.studentNote ?? null,
      isLate,
      status: isLate ? "LATE" : "SUBMITTED",
      submittedAt: now,
    },
    update: {
      fileName: parsed.data.fileName,
      studentNote: parsed.data.studentNote ?? null,
      isLate,
      status: isLate ? "LATE" : "SUBMITTED",
      submittedAt: now,
    },
    select: { id: true, isLate: true },
  })

  revalidatePath(`/dashboard/student/assignments/${assignmentId}`)
  revalidatePath(`/dashboard/student/courses/${assignment.courseId}`)
  revalidatePath("/dashboard/student")
  return { success: true, data: submission }
}
