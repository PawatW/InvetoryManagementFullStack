"use client"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface LineDataPoint {
  name: string
  studentScore: number | null
  classAvg: number | null
  courseCode: string
}

export interface BarDataPoint {
  name: string
  score: number
  count: number
}

interface ProgressChartsProps {
  lineData: LineDataPoint[]
  barData: BarDataPoint[]
}

const BAR_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981"]

function formatPercent(value: unknown) {
  if (typeof value !== "number") return ""
  return `${value.toFixed(1)}%`
}

export function ProgressCharts({ lineData, barData }: ProgressChartsProps) {
  return (
    <div className="space-y-6">
      {/* Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">คะแนนของฉัน vs ค่าเฉลี่ยชั้น</CardTitle>
          <p className="text-xs text-muted-foreground">เฉพาะงานที่ตรวจแล้ว เรียงตามวันกำหนดส่ง</p>
        </CardHeader>
        <CardContent>
          {lineData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              ยังไม่มีข้อมูลคะแนนที่ตรวจแล้ว
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  width={45}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)}%`,
                    name === "studentScore" ? "คะแนนของฉัน" : "ค่าเฉลี่ยชั้น",
                  ]}
                  labelFormatter={(label) => `งาน: ${label}`}
                />
                <Legend
                  formatter={(value) =>
                    value === "studentScore" ? "คะแนนของฉัน" : "ค่าเฉลี่ยชั้น"
                  }
                />
                <Line
                  type="monotone"
                  dataKey="studentScore"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#2563eb" }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="classAvg"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: "#9ca3af" }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">คะแนนเฉลี่ยตามประเภทงาน</CardTitle>
          <p className="text-xs text-muted-foreground">เฉลี่ยจากงานที่ตรวจแล้วทุกวิชา</p>
        </CardHeader>
        <CardContent>
          {barData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              ยังไม่มีข้อมูล
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  width={45}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "คะแนนเฉลี่ย"]}
                  labelFormatter={(label) => `ประเภท: ${label}`}
                />
                <Bar dataKey="score" name="คะแนนเฉลี่ย" radius={[6, 6, 0, 0]}>
                  {barData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
