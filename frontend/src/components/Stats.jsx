import { useFlash } from "../useFlash";

function StatCard({ label, value, sub, color }) {
  const flash = useFlash(typeof value === "number" ? value : 0);
  return (
    <div className="card p-3 sm:p-4">
      <p className="label mb-2">{label}</p>
      <p className={`text-base sm:text-lg font-bold tabular-nums ${color ?? "text-white"} ${flash}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Stats({ stats }) {
  if (!stats) return null;
  const {
    total_trades, closed_trades, win_count, loss_count,
    total_pnl, avg_win, avg_loss, profit_factor,
    max_drawdown_pct, total_fees, open_positions,
  } = stats;

  const pnlPos  = total_pnl >= 0;
  const ddColor = max_drawdown_pct <= -10 ? "text-rose-400"
                : max_drawdown_pct <= -5  ? "text-yellow-400"
                : "text-gray-300";

  const fmt = (n, prefix = "$") =>
    `${n >= 0 ? prefix : "-" + prefix}${Math.abs(n).toLocaleString("en", { minimumFractionDigits: 2 })}`;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <StatCard
        label="총 거래수"
        value={`${total_trades}건`}
        sub={`청산 ${closed_trades}건`}
      />
      <StatCard
        label="총 실현손익"
        value={fmt(total_pnl)}
        color={pnlPos ? "val-pos" : "val-neg"}
        sub={`승 ${win_count} / 패 ${loss_count}`}
      />
      <StatCard
        label="평균 수익"
        value={avg_win ? fmt(avg_win) : "-"}
        color="val-pos"
      />
      <StatCard
        label="평균 손실"
        value={avg_loss ? fmt(avg_loss) : "-"}
        color={avg_loss < 0 ? "val-neg" : "text-gray-300"}
      />
      <StatCard
        label="수익 팩터"
        value={profit_factor ? profit_factor.toFixed(2) + "x" : "-"}
        color={profit_factor >= 1.5 ? "val-pos" : profit_factor > 0 ? "text-yellow-400" : "text-gray-300"}
        sub={profit_factor >= 2 ? "우수" : profit_factor >= 1 ? "양호" : ""}
      />
      <StatCard
        label="최대 낙폭"
        value={`${max_drawdown_pct.toFixed(2)}%`}
        color={ddColor}
        sub={`수수료 합계 ${fmt(total_fees)}`}
      />
    </div>
  );
}
