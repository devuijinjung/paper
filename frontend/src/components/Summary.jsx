import { useMemo } from "react";
import { useFlash } from "../useFlash";

function StatCard({ label, value, colorClass, flashValue }) {
  const flashCls = useFlash(flashValue ?? 0);
  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${colorClass ?? "text-white"} ${flashCls}`}>
        {value}
      </p>
    </div>
  );
}

export default function Summary({ portfolio, streamPrices }) {
  if (!portfolio) return null;

  const { cash, equity: dbEquity, total_return_pct: dbReturnPct, win_rate, positions } = portfolio;

  // Real-time equity: cash + Σ(qty × live price)
  const liveEquity = useMemo(() => {
    if (!positions?.length) return dbEquity;
    return positions.reduce((sum, p) => {
      const livePrice = streamPrices?.[p.ticker]?.price ?? p.current_price;
      return sum + p.qty * livePrice;
    }, cash);
  }, [cash, positions, streamPrices, dbEquity]);

  // Derive initial capital from DB values to avoid needing an extra API field
  const initialCapital = useMemo(() => {
    if (!dbEquity || dbReturnPct === undefined) return 10000;
    return dbEquity / (1 + dbReturnPct / 100);
  }, [dbEquity, dbReturnPct]);

  const liveReturnPct = initialCapital > 0
    ? ((liveEquity / initialCapital) - 1) * 100
    : 0;

  const isPos = liveReturnPct >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="현금 잔고"
        value={`$${cash.toLocaleString("en", { minimumFractionDigits: 2 })}`}
        flashValue={cash}
      />
      <StatCard
        label="총 평가자산"
        value={`$${liveEquity.toLocaleString("en", { minimumFractionDigits: 2 })}`}
        flashValue={liveEquity}
      />
      <StatCard
        label="누적 수익률"
        value={`${isPos ? "+" : ""}${liveReturnPct.toFixed(2)}%`}
        colorClass={isPos ? "text-emerald-400" : "text-rose-400"}
        flashValue={liveReturnPct}
      />
      <StatCard
        label="승률"
        value={`${(win_rate ?? 0).toFixed(1)}%`}
        flashValue={win_rate}
      />
    </div>
  );
}
