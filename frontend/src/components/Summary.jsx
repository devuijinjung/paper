import { useMemo } from "react";
import { useFlash } from "../useFlash";

function Card({ label, value, color, flash }) {
  const cls = useFlash(flash ?? 0);
  return (
    <div className="card p-4">
      <p className="label mb-2">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color ?? "text-white"} ${cls}`}>{value}</p>
    </div>
  );
}

export default function Summary({ portfolio, streamPrices }) {
  if (!portfolio) return null;
  const { cash, equity: dbEquity, total_return_pct: dbRet, win_rate, positions } = portfolio;

  const liveEquity = useMemo(() => {
    if (!positions?.length) return dbEquity;
    return positions.reduce((s, p) => s + p.qty * (streamPrices?.[p.ticker]?.price ?? p.current_price), cash);
  }, [cash, positions, streamPrices, dbEquity]);

  const initialCapital = useMemo(
    () => (dbEquity && dbRet !== undefined ? dbEquity / (1 + dbRet / 100) : 10000),
    [dbEquity, dbRet]
  );
  const liveRet = initialCapital > 0 ? ((liveEquity / initialCapital) - 1) * 100 : 0;
  const isPos   = liveRet >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <Card label="현금 잔고"   value={`$${cash.toLocaleString("en",{minimumFractionDigits:2})}`}   flash={cash} />
      <Card label="총 평가자산" value={`$${liveEquity.toLocaleString("en",{minimumFractionDigits:2})}`} flash={liveEquity} />
      <Card
        label="누적 수익률"
        value={`${isPos?"+":""}${liveRet.toFixed(2)}%`}
        color={isPos ? "val-pos" : "val-neg"}
        flash={liveRet}
      />
      <Card label="승률" value={`${(win_rate??0).toFixed(1)}%`} flash={win_rate} />
    </div>
  );
}
