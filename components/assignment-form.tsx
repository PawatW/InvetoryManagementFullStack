"use client"

import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AssignmentInput } from "@/app/actions/assignments"

const ASSIGNMENT_TYPES = [
  { value: "HOMEWORK", label: "การบ้าน" },
  { value: "QUIZ", label: "แบบทดสอบ" },
  { value: "MIDTERM", label: "สอบกลางภาค" },
  { value: "FINAL", label: "สอบปลายภาค" },
  { value: "PROJECT", label: "โปรเจกต์" },
]

const formSchema = z.object({
  title: z.string().min(1, "กรุณากรอกชื่องาน").max(100, "ชื่องานต้องไม่เกิน 100 ตัวอักษร"),
  description: z.string().optional(),
  type: z.enum(["HOMEWORK", "QUIZ", "MIDTERM", "FINAL", "PROJECT"]),
  weight: z.coerce.number().min(1, "น้ำหนักต้องอย่างน้อย 1").max(100),
  maxScore: z.coerce.number().min(1, "คะแนนเต็มต้องอย่างน้อย 1"),
  dueDate: z.string().min(1, "กรุณาระบุวันกำหนดส่ง"),
  allowLate: z.boolean(),
  rubrics: z
    .array(
      z.object({
        label: z.string().min(1, "กรุณากรอกชื่อเกณฑ์"),
        maxPoints: z.coerce.number().min(0.1),
      })
    )
    .optional(),
})

type FormValues = z.infer<typeof formSchema>

interface AssignmentFormProps {
  courseId: string
  usedWeight: number
  defaultValues?: Partial<FormValues>
  onSubmit: (data: AssignmentInput) => Promise<{ success: boolean; error?: string }>
  submitLabel?: string
  cancelHref: string
}

export function AssignmentForm({
  courseId,
  usedWeight,
  defaultValues,
  onSubmit,
  submitLabel = "สร้างงาน",
  cancelHref,
}: AssignmentFormProps) {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "HOMEWORK",
      weight: 10,
      maxScore: 100,
      dueDate: "",
      allowLate: false,
      rubrics: [],
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "rubrics" })

  const watchedWeight = watch("weight") ?? 0
  const watchedMaxScore = watch("maxScore") ?? 100
  const watchedRubrics = watch("rubrics") ?? []
  const totalRubricPoints = watchedRubrics.reduce((s, r) => s + (Number(r.maxPoints) || 0), 0)

  const remainingWeight =
    100 - usedWeight + (defaultValues?.weight ?? 0) - watchedWeight

  const handleFormSubmit = async (values: FormValues) => {
    const result = await onSubmit(values as AssignmentInput)
    if (!result.success) {
      toast.error(result.error ?? "เกิดข้อผิดพลาด")
      return
    }
    toast.success("บันทึกเรียบร้อยแล้ว")
    router.push(`/dashboard/instructor/courses/${courseId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-2xl">
      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลทั่วไป</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">ชื่องาน *</Label>
            <Input id="title" placeholder="เช่น HW1: Variables and Types" {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">คำอธิบาย (ถ้ามี)</Label>
            <Textarea
              id="description"
              placeholder="รายละเอียดของงาน..."
              rows={3}
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ประเภทงาน *</Label>
              <Select
                defaultValue={defaultValues?.type ?? "HOMEWORK"}
                onValueChange={(v) =>
                  setValue("type", v as FormValues["type"], { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกประเภท" />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxScore">คะแนนเต็ม *</Label>
              <Input id="maxScore" type="number" min={1} {...register("maxScore")} />
              {errors.maxScore && (
                <p className="text-sm text-destructive">{errors.maxScore.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">
              น้ำหนักคะแนน (%) *{" "}
              <span
                className={`text-xs ml-2 ${
                  remainingWeight < 0 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                (เหลือได้อีก {remainingWeight}%)
              </span>
            </Label>
            <Input id="weight" type="number" min={1} max={100} {...register("weight")} />
            {errors.weight && <p className="text-sm text-destructive">{errors.weight.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Deadline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">กำหนดส่ง</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dueDate">วันและเวลากำหนดส่ง *</Label>
            <Input id="dueDate" type="datetime-local" {...register("dueDate")} />
            {errors.dueDate && (
              <p className="text-sm text-destructive">{errors.dueDate.message}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="allowLate"
              defaultChecked={defaultValues?.allowLate ?? false}
              onCheckedChange={(v) => setValue("allowLate", v)}
            />
            <Label htmlFor="allowLate" className="cursor-pointer">
              อนุญาตให้ส่งงานช้าได้
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Rubric Criteria */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">เกณฑ์การตรวจ (Rubric)</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ label: "", maxPoints: 10 })}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            เพิ่มเกณฑ์
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              ยังไม่มีเกณฑ์การตรวจ — กด "เพิ่มเกณฑ์" เพื่อเพิ่ม
            </p>
          )}
          {fields.map((field, i) => (
            <div key={field.id} className="flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder={`เกณฑ์ที่ ${i + 1} เช่น ความถูกต้อง`}
                  {...register(`rubrics.${i}.label`)}
                />
                {errors.rubrics?.[i]?.label && (
                  <p className="text-xs text-destructive">
                    {errors.rubrics[i]?.label?.message}
                  </p>
                )}
              </div>
              <div className="w-24 space-y-1">
                <Input
                  type="number"
                  min={0.1}
                  step={0.5}
                  placeholder="คะแนน"
                  {...register(`rubrics.${i}.maxPoints`)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5"
                onClick={() => remove(i)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {fields.length > 0 && (
            <>
              <Separator />
              <p
                className={`text-sm font-medium text-right ${
                  totalRubricPoints > watchedMaxScore
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                รวม Rubric: {totalRubricPoints} / {watchedMaxScore} คะแนน
                {totalRubricPoints > watchedMaxScore && (
                  <span className="ml-2">(เกินคะแนนเต็ม)</span>
                )}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.push(cancelHref)}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
