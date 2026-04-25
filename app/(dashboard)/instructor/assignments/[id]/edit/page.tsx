import { notFound } from "next/navigation"
import { format } from "date-fns"
import { requireRole } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { AssignmentForm } from "@/components/assignment-form"
import { updateAssignment, type AssignmentInput } from "@/app/actions/assignments"

interface Props {
  params: { id: string }
}

export default async function EditAssignmentPage({ params }: Props) {
  const user = await requireRole("INSTRUCTOR")

  const assignment = await db.assignment.findFirst({
    where: { id: params.id, course: { instructorId: user.id } },
    include: {
      course: {
        include: {
          assignments: { select: { id: true, weight: true } },
        },
      },
      rubrics: { orderBy: { order: "asc" } },
    },
  })

  if (!assignment) notFound()

  // Weight used by OTHER assignments in the same course
  const usedWeight = assignment.course.assignments
    .filter((a) => a.id !== params.id)
    .reduce((s, a) => s + a.weight, 0)

  const defaultValues = {
    title: assignment.title,
    description: assignment.description ?? "",
    type: assignment.type,
    weight: assignment.weight,
    maxScore: assignment.maxScore,
    dueDate: format(assignment.dueDate, "yyyy-MM-dd'T'HH:mm"),
    allowLate: assignment.allowLate,
    rubrics: assignment.rubrics.map((r) => ({
      label: r.label,
      maxPoints: r.maxPoints,
    })),
  }

  async function handleUpdate(data: AssignmentInput) {
    "use server"
    return updateAssignment(params.id, data)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <p className="text-sm text-muted-foreground font-mono">
          {assignment.course.code} — {assignment.course.title}
        </p>
        <h1 className="text-2xl font-bold mt-1">แก้ไขงาน</h1>
        <p className="text-muted-foreground text-sm mt-1 truncate">{assignment.title}</p>
      </div>

      <AssignmentForm
        courseId={assignment.courseId}
        usedWeight={usedWeight}
        defaultValues={defaultValues as Parameters<typeof AssignmentForm>[0]["defaultValues"]}
        onSubmit={handleUpdate}
        submitLabel="บันทึกการเปลี่ยนแปลง"
        cancelHref={`/dashboard/instructor/courses/${assignment.courseId}`}
      />
    </div>
  )
}
