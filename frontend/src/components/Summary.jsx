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

export default function Summary({ portfolio }) {
  if (!portfolio) return null;
  const { cash, equity, total_return_pct, win_rate } = portfolio;
  const isPos = total_return_pct >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="현금 잔고"
        value={`$${cash.toLocaleString("en", { minimumFractionDigits: 2 })}`}
        flashValue={cash}
      />
      <StatCard
        label="총 평가자산"
        value={`$${equity.toLocaleString("en", { minimumFractionDigits: 2 })}`}
        flashValue={equity}
      />
      <StatCard
        label="누적 수익률"
        value={`${isPos ? "+" : ""}${total_return_pct.toFixed(2)}%`}
        colorClass={isPos ? "text-emerald-400" : "text-rose-400"}
        flashValue={total_return_pct}
      />
      <StatCard
        label="승률"
        value={`${win_rate.toFixed(1)}%`}
        flashValue={win_rate}
      />
    </div>
  );
}
