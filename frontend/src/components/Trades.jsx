export default function Trades({ trades }) {
  if (!trades?.length)
    return <p className="text-gray-500 text-sm py-4">거래 내역 없음</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-xs border-b border-gray-700">
            {["시각", "종목", "방향", "가격", "수량", "수수료", "실현손익"].map((h) => (
              <th key={h} className="py-2 pr-4 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const isPos = t.realized_pnl >= 0;
            return (
              <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">
                  {new Date(t.ts).toLocaleString("ko")}
                </td>
                <td className="py-2 pr-4 font-medium text-white">{t.ticker}</td>
                <td className={`py-2 pr-4 font-semibold ${t.side === "buy" ? "text-emerald-400" : "text-rose-400"}`}>
                  {t.side.toUpperCase()}
                </td>
                <td className="py-2 pr-4">${t.price.toFixed(4)}</td>
                <td className="py-2 pr-4">{t.qty.toFixed(6)}</td>
                <td className="py-2 pr-4 text-gray-400">${t.fee.toFixed(4)}</td>
                <td className={`py-2 pr-4 ${t.realized_pnl === 0 ? "text-gray-500" : isPos ? "text-emerald-400" : "text-rose-400"}`}>
                  {t.realized_pnl === 0 ? "-" : `${isPos ? "+" : ""}${t.realized_pnl.toFixed(2)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
