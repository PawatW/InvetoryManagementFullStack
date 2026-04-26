"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Lock, Loader2, ChevronLeft, ChevronRight } from "lucide-react"

import { saveGrade } from "@/app/actions/grades"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
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

interface RubricCriteria {
  id: string
  label: string
  maxPoints: number
}

interface ExistingGrade {
  score: number
  instructorNote: string | null
  privateNote: string | null
  rubricScores: Record<string, number> | null
}

interface GradeFormProps {
  submissionId: string
  maxScore: number
  rubrics: RubricCriteria[]
  existingGrade: ExistingGrade | null
  prevId: string | null
  nextId: string | null
}

export function GradeForm({
  submissionId,
  maxScore,
  rubrics,
  existingGrade,
  prevId,
  nextId,
}: GradeFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const hasRubrics = rubrics.length > 0

  const [rubricValues, setRubricValues] = useState<Record<string, number>>(() =>
    rubrics.reduce(
      (acc, r) => ({ ...acc, [r.id]: existingGrade?.rubricScores?.[r.id] ?? 0 }),
      {}
    )
  )
  const [directScore, setDirectScore] = useState(existingGrade?.score ?? 0)
  const [instructorNote, setInstructorNote] = useState(existingGrade?.instructorNote ?? "")
  const [privateNote, setPrivateNote] = useState(existingGrade?.privateNote ?? "")

  const rubricTotal = Object.values(rubricValues).reduce((s, v) => s + (Number(v) || 0), 0)
  const finalScore = hasRubrics ? rubricTotal : directScore
  const scorePct = (finalScore / maxScore) * 100
  const letterGrade = scoreToGrade(scorePct)
  const gradeColor = scoreToGradeColor(scorePct)
  const exceedsMax = finalScore > maxScore

  const handleSave = () => {
    if (exceedsMax) {
      toast.error(`คะแนนต้องไม่เกิน ${maxScore}`)
      return
    }
    startTransition(async () => {
      const result = await saveGrade(submissionId, {
        score: finalScore,
        rubricScores: hasRubrics ? rubricValues : undefined,
        instructorNote: instructorNote || undefined,
        privateNote: privateNote || undefined,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("บันทึกคะแนนเรียบร้อยแล้ว")
      router.refresh()
    })
  }

  const navigate = (id: string) => router.push(`/dashboard/instructor/submissions/${id}/grade`)

  return (
    <div className="space-y-5">
      {/* Rubric or direct score */}
      {hasRubrics ? (
        <div className="rounded-md border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เกณฑ์</TableHead>
                <TableHead className="text-right w-28">คะแนน (สูงสุด)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rubrics.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.label}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={r.maxPoints}
                        step={0.5}
                        value={rubricValues[r.id] ?? 0}
                        onChange={(e) =>
                          setRubricValues((prev) => ({
                            ...prev,
                            [r.id]: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-20 text-right h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">/{r.maxPoints}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell className="text-sm">รวม</TableCell>
                <TableCell className={cn("text-right text-sm", exceedsMax && "text-destructive")}>
                  {rubricTotal} / {maxScore}
                  {exceedsMax && (
                    <span className="ml-1 text-xs">(เกิน!)</span>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>คะแนนรวม *</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={maxScore}
              step={0.5}
              value={directScore}
              onChange={(e) => setDirectScore(parseFloat(e.target.value) || 0)}
              className={cn("w-32", exceedsMax && "border-destructive")}
            />
            <span className="text-sm text-muted-foreground">/ {maxScore} คะแนน</span>
          </div>
          {exceedsMax && (
            <p className="text-xs text-destructive">คะแนนต้องไม่เกิน {maxScore}</p>
          )}
        </div>
      )}

      {/* Score visual */}
      <div className="rounded-lg bg-muted/40 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">คะแนนรวม</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">{finalScore}</span>
            <span className="text-muted-foreground text-sm">/ {maxScore}</span>
            <span className={cn("text-lg font-bold ml-1", gradeColor)}>{letterGrade}</span>
          </div>
        </div>
        <Progress
          value={Math.min(100, scorePct)}
          className="h-2"
          indicatorClassName={exceedsMax ? "bg-destructive" : undefined}
        />
        <p className="text-xs text-right text-muted-foreground">{scorePct.toFixed(1)}%</p>
      </div>

      <Separator />

      {/* Notes */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="instructorNote">ข้อเสนอแนะ (นักศึกษาเห็นได้)</Label>
          <Textarea
            id="instructorNote"
            placeholder="เขียนข้อเสนอแนะให้นักศึกษา..."
            rows={3}
            value={instructorNote}
            onChange={(e) => setInstructorNote(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="privateNote" className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            โน๊ต private (เฉพาะอาจารย์)
          </Label>
          <Textarea
            id="privateNote"
            placeholder="บันทึกสำหรับตัวเอง..."
            rows={2}
            value={privateNote}
            onChange={(e) => setPrivateNote(e.target.value)}
          />
        </div>
      </div>

      {/* Save */}
      <Button
        className="w-full"
        onClick={handleSave}
        disabled={isPending || exceedsMax}
      >
        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        บันทึกคะแนน
      </Button>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="outline"
          size="sm"
          disabled={!prevId}
          onClick={() => prevId && navigate(prevId)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          นักศึกษาก่อนหน้า
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!nextId}
          onClick={() => nextId && navigate(nextId)}
        >
          นักศึกษาถัดไป
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
