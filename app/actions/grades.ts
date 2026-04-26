"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { db } from "@/lib/db"

const gradeSchema = z.object({
  score: z.number().min(0, "คะแนนต้องไม่ติดลบ"),
  rubricScores: z.record(z.number().min(0)).optional(),
  instructorNote: z.string().optional(),
  privateNote: z.string().optional(),
})

type GradeInput = z.infer<typeof gradeSchema>
type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

async function getInstructorSession() {
  const session = await auth()
  if (!session?.user || session.user.role !== "INSTRUCTOR") return null
  return session.user
}

// ── Save Grade ───────────────────────────────────────────────────────────────

export async function saveGrade(
  submissionId: string,
  data: GradeInput
): Promise<ActionResult<{ gradeId: string }>> {
  const instructor = await getInstructorSession()
  if (!instructor) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" }

  const parsed = gradeSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }
  }

  const submission = await db.submission.findFirst({
    where: {
      id: submissionId,
      assignment: { course: { instructorId: instructor.id } },
    },
    include: {
      assignment: {
        select: { id: true, title: true, courseId: true, maxScore: true },
      },
    },
  })
  if (!submission) return { success: false, error: "ไม่พบงานที่ส่งหรือไม่มีสิทธิ์" }

  const { score, rubricScores, instructorNote, privateNote } = parsed.data

  if (score > submission.assignment.maxScore) {
    return {
      success: false,
      error: `คะแนนต้องไม่เกิน ${submission.assignment.maxScore}`,
    }
  }

  const [grade] = await db.$transaction([
    db.grade.upsert({
      where: { submissionId },
      create: {
        submissionId,
        gradedById: instructor.id,
        score,
        rubricScores: rubricScores ?? null,
        instructorNote: instructorNote ?? null,
        privateNote: privateNote ?? null,
      },
      update: {
        gradedById: instructor.id,
        score,
        rubricScores: rubricScores ?? null,
        instructorNote: instructorNote ?? null,
        privateNote: privateNote ?? null,
        updatedAt: new Date(),
      },
    }),
    db.submission.update({
      where: { id: submissionId },
      data: { status: "GRADED" },
    }),
  ])

  // Notify the student
  await db.notification.create({
    data: {
      userId: submission.studentId,
      type: "GRADE_RELEASED",
      title: "คะแนนประกาศแล้ว",
      message: `อาจารย์ตรวจงาน "${submission.assignment.title}" แล้ว คะแนนที่ได้: ${score}`,
      link: `/dashboard/student/assignments/${submission.assignment.id}`,
    },
  })

  revalidatePath(`/dashboard/instructor/assignments/${submission.assignment.id}/submissions`)
  revalidatePath(`/dashboard/instructor/submissions/${submissionId}/grade`)
  revalidatePath(`/dashboard/instructor/courses/${submission.assignment.courseId}`)
  revalidatePath("/dashboard/instructor")
  return { success: true, data: { gradeId: grade.id } }
}

// ── Next / Prev Submission ───────────────────────────────────────────────────

async function getOrderedSubmissions(assignmentId: string) {
  return db.submission.findMany({
    where: { assignmentId },
    include: { student: { select: { name: true } } },
    orderBy: { student: { name: "asc" } },
    select: { id: true, student: { select: { name: true } } },
  })
}

export async function getNextSubmission(
  assignmentId: string,
  currentSubmissionId: string
): Promise<string | null> {
  const submissions = await getOrderedSubmissions(assignmentId)
  const idx = submissions.findIndex((s) => s.id === currentSubmissionId)
  if (idx === -1 || idx >= submissions.length - 1) return null
  return submissions[idx + 1].id
}

export async function getPrevSubmission(
  assignmentId: string,
  currentSubmissionId: string
): Promise<string | null> {
  const submissions = await getOrderedSubmissions(assignmentId)
  const idx = submissions.findIndex((s) => s.id === currentSubmissionId)
  if (idx <= 0) return null
  return submissions[idx - 1].id
}
