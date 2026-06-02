import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Brush,
} from "recharts";
import { useMemo } from "react";

const fmt = (v) => `$${Number(v).toLocaleString("en",{minimumFractionDigits:0,maximumFractionDigits:0})}`;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const eq = payload.find(p => p.dataKey === "equity");
  const dd = payload.find(p => p.dataKey === "drawdown");
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {eq && <p className="text-emerald-400 font-semibold">{fmt(eq.value)}</p>}
      {dd && <p className={`font-medium ${dd.value < -5 ? "text-rose-400" : "text-gray-400"}`}>
        낙폭 {dd.value.toFixed(2)}%
      </p>}
    </div>
  );
}

export default function EquityCurve({ history }) {
  const data = useMemo(() => {
    if (!history?.length) return [];
    let peak = 0;
    return history.map(h => {
      if (h.equity > peak) peak = h.equity;
      const drawdown = peak > 0 ? ((h.equity - peak) / peak * 100) : 0;
      return {
        ts: new Date(h.ts).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" }),
        equity: parseFloat(h.equity.toFixed(2)),
        drawdown: parseFloat(drawdown.toFixed(2)),
      };
    });
  }, [history]);

  const initialEquity = data[0]?.equity;

  if (!data.length)
    return <div className="flex items-center justify-center h-48 text-gray-600">데이터 없음</div>;

  return (
    <div className="space-y-4">
      {/* Equity Area */}
      <div>
        <p className="label mb-3">자산 곡선</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="ts" tick={{ fill: "#4b5563", fontSize: 10 }} minTickGap={50} />
            <YAxis tick={{ fill: "#4b5563", fontSize: 10 }} width={72} tickFormatter={fmt} />
            {initialEquity && (
              <ReferenceLine y={initialEquity} stroke="#374151" strokeDasharray="4 4"
                label={{ value: "원금", fill: "#4b5563", fontSize: 10, position: "insideTopLeft" }} />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="equity" stroke="#10b981"
              strokeWidth={2} fill="url(#eq)" dot={false} />
            {data.length > 5 && (
              <Brush dataKey="ts" height={20} stroke="#1f2937" fill="#0f172a"
                travellerWidth={6}
                style={{ fontSize: 9, fill: "#4b5563" }}
                startIndex={Math.max(0, data.length - 60)}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Drawdown */}
      <div>
        <p className="label mb-3">낙폭 (Drawdown)</p>
        <ResponsiveContainer width="100%" height={100}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="ts" tick={{ fill: "#4b5563", fontSize: 10 }} minTickGap={50} />
            <YAxis tick={{ fill: "#4b5563", fontSize: 10 }} width={42}
              tickFormatter={v => `${v.toFixed(0)}%`} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
              formatter={(v) => [`${v.toFixed(2)}%`, "낙폭"]}
            />
            <Area type="monotone" dataKey="drawdown" stroke="#f43f5e"
              strokeWidth={1.5} fill="#f43f5e22" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
