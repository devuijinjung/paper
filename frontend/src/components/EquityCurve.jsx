import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export default function EquityCurve({ history }) {
  if (!history?.length) return <p className="text-gray-500 text-sm py-4">데이터 없음</p>;

  const data = history.map((h) => ({
    ts: new Date(h.ts).toLocaleTimeString("ko"),
    equity: parseFloat(h.equity.toFixed(2)),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="ts" tick={{ fill: "#9ca3af", fontSize: 11 }} minTickGap={40} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} width={72}
          tickFormatter={(v) => `$${v.toLocaleString()}`} />
        <Tooltip
          contentStyle={{ background: "#1f2937", border: "none", borderRadius: 8 }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(v) => [`$${v.toLocaleString()}`, "자산"]}
        />
        <Area type="monotone" dataKey="equity" stroke="#10b981"
          strokeWidth={2} fill="url(#eq)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
