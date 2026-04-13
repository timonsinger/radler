'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DayStats {
  date: string;
  revenue: number;
  platformFees: number;
}

export default function RevenueChart({ data }: { data: DayStats[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
  }));

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={(v) => `${v}€`} />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value.toFixed(2).replace('.', ',')} €`,
              name === 'revenue' ? 'Umsatz' : 'Provision',
            ]}
            labelFormatter={(label) => `Datum: ${label}`}
          />
          <Legend formatter={(v) => (v === 'revenue' ? 'Umsatz' : 'Provision')} />
          <Line type="monotone" dataKey="revenue" stroke="#14532D" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="platformFees" stroke="#22C55E" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
