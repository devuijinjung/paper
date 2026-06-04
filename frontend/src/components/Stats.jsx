import { fmtKrw } from "../fmt";

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-ink-850 border border-ink-700 rounded-xl p-4 hover:border-ink-600 transition-colors">
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-lg font-bold tabular-nums font-mono ${color ?? "text-gray-100"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-ink-850 border border-ink-700 rounded-xl p-4">
          <div className="skeleton h-3 w-16 mb-3" />
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
  const ddColor = max_drawdown_pct <= -10 ? "text-down"
                : max_drawdown_pct <= -5  ? "text-brand-500"
                : "text-gray-300";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard label="총 거래수"
        value={`${total_trades}건`}
        sub={`청산 ${closed_trades}건`} />
      <StatCard label="총 실현손익"
        value={fmtKrw(total_pnl, rate, pnlPos)}
        color={pnlPos ? "text-up" : "text-down"}
        sub={`승 ${win_count} · 패 ${loss_count}`} />
      <StatCard label="평균 수익"
        value={avg_win ? fmtKrw(avg_win, rate, true) : "—"}
        color="text-up" />
      <StatCard label="평균 손실"
        value={avg_loss ? fmtKrw(avg_loss, rate) : "—"}
        color={avg_loss < 0 ? "text-down" : "text-gray-300"} />
      <StatCard label="손익비"
        value={profit_factor ? `${profit_factor.toFixed(2)}×` : "—"}
        color={profit_factor >= 1.5 ? "text-up" : profit_factor > 0 ? "text-brand-500" : "text-gray-300"}
        sub={profit_factor >= 2 ? "우수" : profit_factor >= 1 ? "양호" : profit_factor > 0 ? "주의" : ""} />
      <StatCard label="최대 낙폭"
        value={`${max_drawdown_pct.toFixed(2)}%`}
        color={ddColor}
        sub={`수수료 ${fmtKrw(total_fees, rate)}`} />
    </div>
  );
}
