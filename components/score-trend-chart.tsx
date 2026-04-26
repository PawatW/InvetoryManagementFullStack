"use client"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import type { TrendPoint } from "@/lib/chart-utils"

export function ScoreTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        ยังไม่มีข้อมูลคะแนนที่ตรวจแล้ว
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          width={45}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            color: "hsl(var(--foreground))",
          }}
          formatter={(value: number, key: string) => [
            `${value.toFixed(1)}%`,
            key === "mine" ? "คะแนนของฉัน" : "ค่าเฉลี่ยชั้น",
          ]}
          labelFormatter={(label) => `งาน: ${label}`}
        />
        <Legend
          formatter={(key) =>
            key === "mine" ? "คะแนนของฉัน" : "ค่าเฉลี่ยชั้น"
          }
        />
        <Line
          type="monotone"
          dataKey="mine"
          name="mine"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ r: 4, fill: "#2563eb" }}
          activeDot={{ r: 6 }}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="avg"
          name="avg"
          stroke="#9ca3af"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3, fill: "#9ca3af" }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
