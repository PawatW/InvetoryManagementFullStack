"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import type { AssignmentType } from "@prisma/client"

// ── Validation schema ────────────────────────────────────────────────────────

const rubricSchema = z.object({
  label: z.string().min(1, "กรุณากรอกชื่อเกณฑ์"),
  maxPoints: z.number().min(0.1, "คะแนนต้องมากกว่า 0"),
})

const assignmentSchema = z.object({
  title: z.string().min(1, "กรุณากรอกชื่องาน").max(100, "ชื่องานต้องไม่เกิน 100 ตัวอักษร"),
  description: z.string().optional(),
  type: z.enum(["HOMEWORK", "QUIZ", "MIDTERM", "FINAL", "PROJECT"]),
  weight: z.number().min(1, "น้ำหนักต้องอย่างน้อย 1").max(100, "น้ำหนักต้องไม่เกิน 100"),
  maxScore: z.number().min(1, "คะแนนเต็มต้องอย่างน้อย 1"),
  dueDate: z.string().min(1, "กรุณาระบุวันกำหนดส่ง"),
  allowLate: z.boolean(),
  rubrics: z.array(rubricSchema).optional(),
})

export type AssignmentInput = z.infer<typeof assignmentSchema>

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

// ── Auth helper ──────────────────────────────────────────────────────────────

async function getInstructorSession() {
  const session = await auth()
  if (!session?.user || session.user.role !== "INSTRUCTOR") {
    return null
  }
  return session.user
}

async function verifyCourseOwnership(courseId: string, instructorId: string) {
  const course = await db.course.findFirst({
    where: { id: courseId, instructorId },
  })
  return course !== null
}

// ── Create Assignment ────────────────────────────────────────────────────────

export async function createAssignment(
  courseId: string,
  data: AssignmentInput
): Promise<ActionResult<{ id: string }>> {
  const instructor = await getInstructorSession()
  if (!instructor) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" }

  const owns = await verifyCourseOwnership(courseId, instructor.id)
  if (!owns) return { success: false, error: "ไม่พบรายวิชาหรือไม่มีสิทธิ์" }

  const parsed = assignmentSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }
  }

  const { rubrics, dueDate, ...rest } = parsed.data

  const assignment = await db.assignment.create({
    data: {
      ...rest,
      type: rest.type as AssignmentType,
      courseId,
      dueDate: new Date(dueDate),
      rubrics: rubrics && rubrics.length > 0
        ? {
            create: rubrics.map((r, i) => ({
              label: r.label,
              maxPoints: r.maxPoints,
              order: i + 1,
            })),
          }
        : undefined,
    },
  })

  revalidatePath(`/dashboard/instructor/courses/${courseId}`)
  revalidatePath("/dashboard/instructor")
  return { success: true, data: { id: assignment.id } }
}

// ── Update Assignment ────────────────────────────────────────────────────────

export async function updateAssignment(
  id: string,
  data: AssignmentInput
): Promise<ActionResult> {
  const instructor = await getInstructorSession()
  if (!instructor) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" }

  const existing = await db.assignment.findFirst({
    where: { id, course: { instructorId: instructor.id } },
    include: { course: true },
  })
  if (!existing) return { success: false, error: "ไม่พบงานหรือไม่มีสิทธิ์" }

  const parsed = assignmentSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }
  }

  const { rubrics, dueDate, ...rest } = parsed.data

  await db.$transaction([
    db.rubricCriteria.deleteMany({ where: { assignmentId: id } }),
    db.assignment.update({
      where: { id },
      data: {
        ...rest,
        type: rest.type as AssignmentType,
        dueDate: new Date(dueDate),
        rubrics: rubrics && rubrics.length > 0
          ? {
              create: rubrics.map((r, i) => ({
                label: r.label,
                maxPoints: r.maxPoints,
                order: i + 1,
              })),
            }
          : undefined,
      },
    }),
  ])

  revalidatePath(`/dashboard/instructor/courses/${existing.courseId}`)
  revalidatePath(`/dashboard/instructor/assignments/${id}/edit`)
  revalidatePath("/dashboard/instructor")
  return { success: true }
}

// ── Delete Assignment ────────────────────────────────────────────────────────

export async function deleteAssignment(id: string): Promise<ActionResult> {
  const instructor = await getInstructorSession()
  if (!instructor) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" }

  const existing = await db.assignment.findFirst({
    where: { id, course: { instructorId: instructor.id } },
  })
  if (!existing) return { success: false, error: "ไม่พบงานหรือไม่มีสิทธิ์" }

  await db.assignment.delete({ where: { id } })

  revalidatePath(`/dashboard/instructor/courses/${existing.courseId}`)
  revalidatePath("/dashboard/instructor")
  return { success: true }
}
