import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useMemo, useState } from "react";
import { fmtKrw, fmtKrwCompact } from "../fmt";

const RANGES = [
  { key: 60,  label: "1H" },
  { key: 240, label: "4H" },
  { key: 0,   label: "전체" },
];

function CustomTooltip({ active, payload, label, rate }) {
  if (!active || !payload?.length) return null;
  const eq = payload.find(p => p.dataKey === "equity");
  const dd = payload.find(p => p.dataKey === "drawdown");
  return (
    <div className="bg-ink-850 border border-ink-700 rounded px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-500 mb-1 font-mono">{label}</p>
      {eq && <p className="text-up font-bold font-mono">{fmtKrw(eq.value, rate)}</p>}
      {dd && <p className={`font-medium ${dd.value < -5 ? "text-down" : "text-gray-400"}`}>
        낙폭 {dd.value.toFixed(2)}%
      </p>}
    </div>
  );
}

export default function EquityCurve({ history, rate }) {
  const [range, setRange] = useState(0);

  const full = useMemo(() => {
    if (!history?.length) return [];
    let peak = 0;
    return history.map(h => {
      if (h.equity > peak) peak = h.equity;
      const drawdown = peak > 0 ? ((h.equity - peak) / peak * 100) : 0;
      return {
        ts:       new Date(h.ts).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" }),
        equity:   parseFloat(h.equity.toFixed(2)),
        drawdown: parseFloat(drawdown.toFixed(2)),
      };
    });
  }, [history]);

  const data = useMemo(
    () => (range > 0 ? full.slice(-range) : full),
    [full, range]
  );

  const initialEquity = data[0]?.equity;
  const lastEquity    = data[data.length - 1]?.equity;
  const periodRet     = initialEquity ? ((lastEquity / initialEquity) - 1) * 100 : 0;
  const retPos        = periodRet >= 0;

  if (!data.length)
    return <div className="flex items-center justify-center h-48 text-gray-600 text-sm">데이터가 없습니다</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">구간 수익률</p>
          <p className={`text-xl font-bold tabular-nums font-mono ${retPos ? "text-up" : "text-down"}`}>
            {retPos ? "+" : ""}{periodRet.toFixed(2)}%
          </p>
        </div>
        <div className="flex border border-ink-700 rounded overflow-hidden">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors
                ${range === r.key
                  ? "bg-brand-500 text-black"
                  : "bg-ink-800 text-gray-500 hover:text-gray-300"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Equity chart */}
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#0ecb81" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#0ecb81" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="ts" tick={{ fill: "#4b5563", fontSize: 10 }} minTickGap={50}
            axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#4b5563", fontSize: 10 }} width={60}
            tickFormatter={v => fmtKrwCompact(v, rate)} axisLine={false} tickLine={false} />
          {initialEquity && (
            <ReferenceLine y={initialEquity} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4"
              label={{ value: "기준", fill: "#4b5563", fontSize: 10, position: "insideTopLeft" }} />
          )}
          <Tooltip content={<CustomTooltip rate={rate} />} />
          <Area type="monotone" dataKey="equity" stroke="#0ecb81" strokeWidth={2}
            fill="url(#eq)" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Drawdown chart */}
      <div>
        <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-3">낙폭 (Drawdown)</p>
        <ResponsiveContainer width="100%" height={90}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="ts" tick={{ fill: "#4b5563", fontSize: 10 }} minTickGap={50}
              axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#4b5563", fontSize: 10 }} width={36}
              tickFormatter={v => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#1e2329", border: "1px solid #2b3139", borderRadius: 6, fontSize: 11 }}
              formatter={(v) => [`${v.toFixed(2)}%`, "낙폭"]} />
            <Area type="monotone" dataKey="drawdown" stroke="#f6465d" strokeWidth={1.5}
              fill="rgba(246,70,93,0.1)" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
