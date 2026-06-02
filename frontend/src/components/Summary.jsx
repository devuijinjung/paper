export default function Summary({ portfolio }) {
  if (!portfolio) return null;
  const { cash, equity, total_return_pct, win_rate } = portfolio;

  const cards = [
    { label: "현금 잔고", value: `$${cash.toLocaleString("en", { minimumFractionDigits: 2 })}` },
    { label: "총 평가자산", value: `$${equity.toLocaleString("en", { minimumFractionDigits: 2 })}` },
    {
      label: "누적 수익률",
      value: `${total_return_pct >= 0 ? "+" : ""}${total_return_pct.toFixed(2)}%`,
      color: total_return_pct >= 0 ? "text-emerald-400" : "text-rose-400",
    },
    { label: "승률", value: `${win_rate.toFixed(1)}%` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-gray-800 rounded-xl p-4 shadow">
          <p className="text-xs text-gray-400 mb-1">{c.label}</p>
          <p className={`text-xl font-bold ${c.color ?? "text-white"}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
