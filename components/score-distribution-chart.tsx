"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts"
import type { DistributionBucket } from "@/lib/chart-utils"

interface Props {
  data: DistributionBucket[]
  mean: number
}

export function ScoreDistributionChart({ data, mean }: Props) {
  const meanBucket = data[Math.min(Math.floor(mean / 10), 9)]?.range

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 24, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="range"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            color: "hsl(var(--foreground))",
          }}
          formatter={(value: number) => [`${value} คน`, "จำนวนนักศึกษา"]}
          labelFormatter={(label) => `คะแนน: ${label}%`}
        />
        {meanBucket && (
          <ReferenceLine
            x={meanBucket}
            stroke="#6366f1"
            strokeDasharray="4 2"
            label={{
              value: `เฉลี่ย ${mean.toFixed(1)}%`,
              fill: "#6366f1",
              fontSize: 11,
              position: "top",
            }}
          />
        )}
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
