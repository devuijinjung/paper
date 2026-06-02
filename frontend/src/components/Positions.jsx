export default function Positions({ positions }) {
  if (!positions?.length)
    return <p className="text-gray-500 text-sm py-4">보유 포지션 없음</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-xs border-b border-gray-700">
            {["종목", "수량", "평단가", "현재가", "평가손익", "수익률"].map((h) => (
              <th key={h} className="py-2 pr-4 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const pct = p.avg_price > 0
              ? ((p.current_price - p.avg_price) / p.avg_price) * 100
              : 0;
            const isPos = p.unrealized_pnl >= 0;
            return (
              <tr key={p.ticker} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-2 pr-4 font-medium text-white">{p.ticker}</td>
                <td className="py-2 pr-4">{p.qty.toFixed(6)}</td>
                <td className="py-2 pr-4">${p.avg_price.toFixed(4)}</td>
                <td className="py-2 pr-4">${p.current_price.toFixed(4)}</td>
                <td className={`py-2 pr-4 ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
                  {isPos ? "+" : ""}{p.unrealized_pnl.toFixed(2)}
                </td>
                <td className={`py-2 pr-4 ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
                  {isPos ? "+" : ""}{pct.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
