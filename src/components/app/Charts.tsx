import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCZK } from "@/lib/format";

export const SERIES: Record<string, { label: string; color: string }> = {
  value: { label: "Hodnota", color: "var(--color-chart-1)" },
  equity: { label: "Equity", color: "var(--color-chart-2)" },
  debt: { label: "Dluh", color: "var(--color-chart-4)" },
  rent: { label: "Nájem", color: "var(--color-chart-3)" },
  cashFlow: { label: "Cash-flow", color: "var(--color-chart-5)" },
  growth: { label: "Růst hodnoty", color: "var(--color-chart-2)" },
};

const compact = (v: number) => new Intl.NumberFormat("cs-CZ", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const tooltipStyle = { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12, color: "var(--color-popover-foreground)" };

export function ValueChart({ data, keys, height = 260 }: { data: Record<string, number | string>[]; keys: string[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          {keys.map((k) => (
            <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES[k]?.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={SERIES[k]?.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [formatCZK(v), SERIES[n]?.label ?? n]} />
        {keys.map((k) => (
          <Area key={k} type="monotone" dataKey={k} stroke={SERIES[k]?.color} fill={`url(#g-${k})`} strokeWidth={2} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({ data, keys, height = 260, fmt = compact }: { data: Record<string, number | string>[]; keys: string[]; height?: number; fmt?: (v: number) => string }) {
  const colors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={52} domain={["auto", "auto"]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, dataKey, height = 260, fmt = compact }: { data: Record<string, number | string>[]; dataKey: string; height?: number; fmt?: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
        <Bar dataKey={dataKey} fill="var(--color-chart-1)" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
