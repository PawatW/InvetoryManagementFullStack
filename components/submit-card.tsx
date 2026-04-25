"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { th } from "date-fns/locale"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, Clock, FileText, Loader2, RotateCcw } from "lucide-react"

import { submitAssignment } from "@/app/actions/submissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { scoreToGrade, scoreToGradeColor } from "@/lib/grade-utils"
import { cn } from "@/lib/utils"

const submitSchema = z.object({
  fileName: z.string().min(1, "กรุณาระบุชื่อไฟล์"),
  studentNote: z.string().optional(),
})
type SubmitValues = z.infer<typeof submitSchema>

interface RubricCriteria {
  id: string
  label: string
  maxPoints: number
}

interface GradeData {
  score: number
  instructorNote: string | null
  rubricScores: Record<string, number> | null
}

interface SubmissionData {
  status: string
  fileName: string | null
  submittedAt: string
  studentNote: string | null
  isLate: boolean
  grade: GradeData | null
}

interface SubmitCardProps {
  assignmentId: string
  maxScore: number
  dueDate: string
  allowLate: boolean
  submission: SubmissionData | null
  rubrics: RubricCriteria[]
}

function SubmitForm({
  assignmentId,
  dueDate,
  allowLate,
  defaultValues,
  onSuccess,
}: {
  assignmentId: string
  dueDate: string
  allowLate: boolean
  defaultValues?: Partial<SubmitValues>
  onSuccess: () => void
}) {
  const isOverdue = new Date() > new Date(dueDate)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubmitValues>({
    resolver: zodResolver(submitSchema),
    defaultValues: { fileName: "", studentNote: "", ...defaultValues },
  })

  const onSubmit = async (values: SubmitValues) => {
    const result = await submitAssignment(assignmentId, values)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(result.data?.isLate ? "ส่งงานสำเร็จ (ช้า)" : "ส่งงานสำเร็จ")
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {isOverdue && allowLate && (
        <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-700">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>เลยกำหนดส่งแล้ว — วิชานี้อนุญาตให้ส่งช้าได้ แต่จะถูกบันทึกว่า "ส่งช้า"</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fileName">ชื่อไฟล์ *</Label>
        <Input id="fileName" placeholder="เช่น assignment1_6XXXXXXX.pdf" {...register("fileName")} />
        {errors.fileName && (
          <p className="text-xs text-destructive">{errors.fileName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="studentNote">หมายเหตุถึงอาจารย์ (ถ้ามี)</Label>
        <Textarea
          id="studentNote"
          placeholder="เขียนข้อความถึงอาจารย์..."
          rows={3}
          {...register("studentNote")}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        ส่งงาน
      </Button>
    </form>
  )
}

export function SubmitCard({
  assignmentId,
  maxScore,
  dueDate,
  allowLate,
  submission,
  rubrics,
}: SubmitCardProps) {
  const router = useRouter()
  const [showResubmitForm, setShowResubmitForm] = useState(false)

  const handleSuccess = () => {
    setShowResubmitForm(false)
    router.refresh()
  }

  // ── Not submitted ──────────────────────────────────────────────────────
  if (!submission) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            ส่งงาน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SubmitForm
            assignmentId={assignmentId}
            dueDate={dueDate}
            allowLate={allowLate}
            onSuccess={handleSuccess}
          />
        </CardContent>
      </Card>
    )
  }

  // ── Submitted / Late (not graded yet) ────────────────────────────────
  if (submission.status === "SUBMITTED" || submission.status === "LATE") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            {submission.status === "LATE" ? "ส่งงานแล้ว (ช้า)" : "ส่งงานแล้ว"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showResubmitForm ? (
            <>
              <p className="text-sm text-muted-foreground">กรอกข้อมูลใหม่เพื่อส่งซ้ำ</p>
              <SubmitForm
                assignmentId={assignmentId}
                dueDate={dueDate}
                allowLate={allowLate}
                defaultValues={{
                  fileName: submission.fileName ?? "",
                  studentNote: submission.studentNote ?? "",
                }}
                onSuccess={handleSuccess}
              />
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowResubmitForm(false)}
              >
                ยกเลิก
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ไฟล์</span>
                  <span className="font-medium truncate max-w-[180px]">{submission.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">วันที่ส่ง</span>
                  <span>{format(new Date(submission.submittedAt), "d MMM yy HH:mm", { locale: th })}</span>
                </div>
                {submission.studentNote && (
                  <div>
                    <p className="text-muted-foreground mb-1">หมายเหตุ</p>
                    <p className="text-foreground">{submission.studentNote}</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                อาจารย์ยังไม่ได้ตรวจงาน
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    ส่งซ้ำ
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ยืนยันการส่งซ้ำ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      งานที่ส่งเดิมจะถูกแทนที่ด้วยงานใหม่ ดำเนินการต่อหรือไม่?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setShowResubmitForm(true)}>
                      ยืนยัน
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Graded ────────────────────────────────────────────────────────────
  const grade = submission.grade!
  const pct = (grade.score / maxScore) * 100
  const letterGrade = scoreToGrade(pct)
  const gradeColor = scoreToGradeColor(pct)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          ผลการตรวจ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Score display */}
        <div className="text-center space-y-2">
          <p className={cn("text-5xl font-bold", gradeColor)}>{letterGrade}</p>
          <p className="text-2xl font-semibold text-foreground">
            {grade.score}{" "}
            <span className="text-muted-foreground text-lg font-normal">/ {maxScore}</span>
          </p>
          <Progress value={pct} className="h-3" />
          <p className="text-sm text-muted-foreground">{pct.toFixed(1)}%</p>
        </div>

        {/* Rubric breakdown */}
        {rubrics.length > 0 && grade.rubricScores && (
          <div>
            <p className="text-sm font-medium mb-2">คะแนนรายเกณฑ์</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เกณฑ์</TableHead>
                  <TableHead className="text-right">คะแนน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubrics.map((r) => {
                  const rubricScore = grade.rubricScores?.[r.id]
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.label}</TableCell>
                      <TableCell className="text-right text-sm">
                        {rubricScore !== undefined ? (
                          <span>
                            {rubricScore}/{r.maxPoints}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Instructor note */}
        {grade.instructorNote && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 space-y-1">
            <p className="text-xs font-medium text-blue-700">ข้อเสนอแนะจากอาจารย์</p>
            <p className="text-sm text-blue-900">{grade.instructorNote}</p>
          </div>
        )}

        {/* Student's own note */}
        {submission.studentNote && (
          <div className="rounded-lg bg-muted p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">หมายเหตุที่ส่งไป</p>
            <p className="text-sm">{submission.studentNote}</p>
          </div>
        )}

        {/* Submission meta */}
        <p className="text-xs text-muted-foreground text-center">
          ส่งเมื่อ {format(new Date(submission.submittedAt), "d MMM yy HH:mm", { locale: th })}
          {submission.isLate && " (ช้า)"}
        </p>
      </CardContent>
    </Card>
  )
}
