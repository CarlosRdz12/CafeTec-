'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMoney } from '@/lib/format'

export function SalesChart({ data }: { data: { day: string; ventas: number }[] }) {
  const total = data.reduce((s, d) => s + d.ventas, 0)
  return (
    <figure>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
            <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} stroke="var(--muted-foreground)" />
            <Tooltip
              cursor={{ fill: 'var(--muted)' }}
              formatter={(v) => [formatMoney(Number(v) * 100), 'Ventas']}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
            />
            <Bar dataKey="ventas" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Ventas por día. Total del periodo: {formatMoney(total * 100)}.</figcaption>
    </figure>
  )
}
