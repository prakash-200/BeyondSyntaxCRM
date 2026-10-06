import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/utils/cn'
import { formatCompactCurrency, formatCurrency, formatNumber } from '@/utils/format'

export const CHART_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b']

const axisProps = { tick: { fontSize: 11, fill: '#64748b' }, tickLine: false, axisLine: false } as const

const tooltipStyle = { borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)', fontSize: 12 }

type TooltipValue = number | string | readonly (number | string)[] | undefined
const money = (v: TooltipValue) => (typeof v === 'number' ? formatCurrency(v) : String(v ?? ''))

export function RevenueTrendChart({ data }: { data: { day: number; current: number | null; previous: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="day" {...axisProps} interval={4} />
        <YAxis {...axisProps} width={52} tickFormatter={formatCompactCurrency} />
        <Tooltip formatter={money} labelFormatter={(d) => `Day ${d}`} contentStyle={tooltipStyle} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="previous" name="Previous month" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
        <Line type="monotone" dataKey="current" name="This month" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SimpleBarChart({ data, xKey, bars, currency }: { data: object[]; xKey: string; bars: { key: string; name: string; color?: string }[]; currency?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={currency ? 52 : 32} tickFormatter={currency ? formatCompactCurrency : undefined} allowDecimals={false} />
        <Tooltip formatter={currency ? money : undefined} contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color ?? CHART_COLORS[i]} radius={[4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DonutChart({ data, centerLabel }: { data: { name: string; value: number }[]; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex h-full flex-col items-center gap-3 sm:flex-row">
      <div className="relative h-full min-h-[170px] w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none">
              {data.map((d, i) => (
                <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums text-slate-900">{formatNumber(total)}</span>
          {centerLabel && <span className="text-[11px] text-slate-500">{centerLabel}</span>}
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-xs sm:w-1/2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden />
              {d.name}
            </span>
            <span className="font-medium tabular-nums text-slate-900">
              {formatNumber(d.value)} <span className="font-normal text-slate-400">({total ? Math.round((d.value / total) * 100) : 0}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Horizontal funnel with stage-to-stage conversion. */
export function FunnelChart({ stages }: { stages: { stage: string; count: number }[] }) {
  const max = Math.max(1, stages[0]?.count ?? 1)
  return (
    <ol className="space-y-1">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].count : null
        const step = prev ? Math.round((s.count / prev) * 100) : null
        return (
          <li key={s.stage}>
            {step !== null && (
              <div className="flex items-center gap-2 py-0.5 pl-1 text-[11px] text-slate-400">
                <span aria-hidden>↓</span>
                <span>{step}% proceed</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-slate-600">{s.stage}</span>
              <div className="h-7 flex-1 rounded-md bg-slate-100">
                <div className={cn('flex h-full items-center justify-end rounded-md px-2 text-xs font-semibold tabular-nums text-white transition-all')} style={{ width: `${Math.max(8, (s.count / max) * 100)}%`, background: CHART_COLORS[0], opacity: 1 - i * 0.12 }}>
                  {s.count}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
