import { useMemo } from "react";
import { useFlash } from "../useFlash";
import { fmtKrw } from "../fmt";
import { IconWallet, IconCoins, IconUp, IconDown, IconTrophy } from "../icons";

function Kpi({ icon, label, value, color, flash, accent, sub }) {
  const cls = useFlash(flash ?? 0);
  return (
    <div className="card card-hover p-4 relative overflow-hidden group">
      <div className={`absolute -right-6 -top-6 w-20 h-20 rounded-full blur-2xl opacity-20
                       group-hover:opacity-40 transition-opacity ${accent}`} />
      <div className="flex items-center gap-2 mb-2.5 text-gray-500">
        <span className="grid place-items-center w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          {icon}
        </span>
        <span className="label">{label}</span>
      </div>
      <p className={`text-xl sm:text-2xl font-extrabold tabular-nums tracking-tight ${color ?? "text-white"} ${cls}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0,1,2,3].map(i => (
        <div key={i} className="card p-4">
          <div className="skeleton h-4 w-20 mb-3" />
          <div className="skeleton h-7 w-28" />
        </div>
      ))}
    </div>
  );
}

export default function Summary({ portfolio, streamPrices, rate }) {
  if (!portfolio) return <SkeletonRow />;
  const { cash, equity: dbEquity, total_return_pct: dbRet, win_rate, positions } = portfolio;

  const liveEquity = useMemo(() => {
    if (!positions?.length) return dbEquity;
    return positions.reduce((s, p) => {
      const live = streamPrices?.[p.ticker]?.price ?? p.current_price;
      const upnl = p.side === "short"
        ? (p.avg_price - live) * p.qty
        : (live - p.avg_price) * p.qty;
      return s + p.avg_price * p.qty + upnl;
    }, cash);
  }, [cash, positions, streamPrices, dbEquity]);

  const initialCapital = useMemo(
    () => (dbEquity && dbRet !== undefined ? dbEquity / (1 + dbRet / 100) : 10000),
    [dbEquity, dbRet]
  );
  const liveRet = initialCapital > 0 ? ((liveEquity / initialCapital) - 1) * 100 : 0;
  const isPos   = liveRet >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Kpi
        icon={<IconCoins width={15} className="text-gray-400" />}
        label="현금 잔고" accent="bg-brand-500"
        value={fmtKrw(cash, rate)} flash={cash}
      />
      <Kpi
        icon={<IconWallet width={15} className="text-gray-400" />}
        label="총 평가자산" accent="bg-emerald-500"
        value={fmtKrw(liveEquity, rate)} flash={liveEquity}
      />
      <Kpi
        icon={isPos ? <IconUp width={15} className="text-emerald-400" /> : <IconDown width={15} className="text-rose-400" />}
        label="누적 수익률" accent={isPos ? "bg-emerald-500" : "bg-rose-500"}
        value={`${isPos?"+":""}${liveRet.toFixed(2)}%`}
        color={isPos ? "val-pos" : "val-neg"} flash={liveRet}
        sub={`평가손익 ${fmtKrw(liveEquity - initialCapital, rate, isPos)}`}
      />
      <Kpi
        icon={<IconTrophy width={15} className="text-amber-400" />}
        label="승률" accent="bg-amber-500"
        value={`${(win_rate??0).toFixed(1)}%`} flash={win_rate}
      />
    </div>
  );
}
