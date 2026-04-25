import { notFound } from "next/navigation"
import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { AssignmentForm } from "@/components/assignment-form"
import { createAssignment, type AssignmentInput } from "@/app/actions/assignments"

interface Props {
  params: { courseId: string }
}

export default async function NewAssignmentPage({ params }: Props) {
  const user = await requireRole("INSTRUCTOR")

  const course = await db.course.findFirst({
    where: { id: params.courseId, instructorId: user.id },
    include: {
      assignments: { select: { weight: true } },
    },
  })

  if (!course) notFound()

  const usedWeight = course.assignments.reduce((s, a) => s + a.weight, 0)

  async function handleCreate(data: AssignmentInput) {
    "use server"
    return createAssignment(params.courseId, data)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <p className="text-sm text-muted-foreground font-mono">{course.code} — {course.title}</p>
        <h1 className="text-2xl font-bold mt-1">สร้างงานใหม่</h1>
        <p className="text-muted-foreground text-sm mt-1">
          น้ำหนักที่ใช้ไปแล้ว: {usedWeight}% / 100%
        </p>
      </div>

      <AssignmentForm
        courseId={params.courseId}
        usedWeight={usedWeight}
        onSubmit={handleCreate}
        submitLabel="สร้างงาน"
        cancelHref={`/dashboard/instructor/courses/${params.courseId}`}
      />
    </div>
  )
}
