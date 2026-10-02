import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function WeeklyStudyChart({
  data,
}: {
  data: Array<{ day: string; minutes: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value: number) => [`${value} h`, "Study time"]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--border)",
            fontSize: 12,
          }}
        />
        <Bar
          dataKey="minutes"
          fill="oklch(0.65 0.19 35)"
          radius={[6, 6, 0, 0]}
          maxBarSize={36}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
