"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { CompletionRow } from "@/lib/chart-utils"

export function CompletionRateChart({ data }: { data: CompletionRow[] }) {
  const height = Math.max(220, data.length * 44 + 60)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          horizontal={false}
        />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            color: "hsl(var(--foreground))",
          }}
          formatter={(value: number, key: string) => [
            `${value} คน`,
            key === "onTime" ? "ตรงเวลา" : key === "late" ? "สาย" : "ไม่ส่ง",
          ]}
        />
        <Legend
          formatter={(key) =>
            key === "onTime" ? "ตรงเวลา" : key === "late" ? "สาย" : "ไม่ส่ง"
          }
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="onTime" name="onTime" stackId="a" fill="#22c55e" />
        <Bar dataKey="late" name="late" stackId="a" fill="#f59e0b" />
        <Bar
          dataKey="missing"
          name="missing"
          stackId="a"
          fill="#ef4444"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
