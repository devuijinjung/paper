import { fmtKrw } from "../fmt";

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card card-hover p-3.5">
      <p className="label mb-1.5">{label}</p>
      <p className={`text-base sm:text-lg font-bold tabular-nums tracking-tight ${color ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card p-3.5">
          <div className="skeleton h-3 w-16 mb-2" />
          <div className="skeleton h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function Stats({ stats, rate }) {
  if (!stats) return <SkeletonStats />;
  const {
    total_trades, closed_trades, win_count, loss_count,
    total_pnl, avg_win, avg_loss, profit_factor,
    max_drawdown_pct, total_fees,
  } = stats;

  const pnlPos  = total_pnl >= 0;
  const ddColor = max_drawdown_pct <= -10 ? "text-rose-400"
                : max_drawdown_pct <= -5  ? "text-amber-400"
                : "text-gray-300";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard label="총 거래수" value={`${total_trades}건`} sub={`청산 ${closed_trades}건`} />
      <StatCard label="총 실현손익" value={fmtKrw(total_pnl, rate, pnlPos)}
        color={pnlPos ? "val-pos" : "val-neg"} sub={`승 ${win_count} · 패 ${loss_count}`} />
      <StatCard label="평균 수익" value={avg_win ? fmtKrw(avg_win, rate, true) : "—"} color="val-pos" />
      <StatCard label="평균 손실" value={avg_loss ? fmtKrw(avg_loss, rate) : "—"}
        color={avg_loss < 0 ? "val-neg" : "text-gray-300"} />
      <StatCard label="손익비" value={profit_factor ? profit_factor.toFixed(2) + "x" : "—"}
        color={profit_factor >= 1.5 ? "val-pos" : profit_factor > 0 ? "text-amber-400" : "text-gray-300"}
        sub={profit_factor >= 2 ? "우수" : profit_factor >= 1 ? "양호" : profit_factor > 0 ? "주의" : ""} />
      <StatCard label="최대 낙폭" value={`${max_drawdown_pct.toFixed(2)}%`} color={ddColor}
        sub={`수수료 ${fmtKrw(total_fees, rate)}`} />
    </div>
  );
}
