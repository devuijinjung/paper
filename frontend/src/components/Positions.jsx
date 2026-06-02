import { useFlash } from "../useFlash";

function PositionRow({ p, streamPrice }) {
  const livePrice       = streamPrice?.price ?? p.current_price;
  const unrealizedPnl   = (livePrice - p.avg_price) * p.qty;
  const pct             = p.avg_price > 0
    ? ((livePrice - p.avg_price) / p.avg_price) * 100
    : 0;
  const isPos           = unrealizedPnl >= 0;
  const priceFashCls    = useFlash(livePrice);
  const pnlFlashCls     = useFlash(unrealizedPnl);

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
      <td className="py-2 pr-4 font-medium text-white">{p.ticker}</td>
      <td className="py-2 pr-4 tabular-nums">{p.qty.toFixed(6)}</td>
      <td className="py-2 pr-4 tabular-nums">${p.avg_price.toFixed(2)}</td>
      <td className={`py-2 pr-4 tabular-nums ${priceFashCls}`}>
        ${livePrice.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className={`py-2 pr-4 tabular-nums ${isPos ? "text-emerald-400" : "text-rose-400"} ${pnlFlashCls}`}>
        {isPos ? "+" : ""}{unrealizedPnl.toFixed(2)}
      </td>
      <td className={`py-2 pr-4 tabular-nums ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
        {isPos ? "+" : ""}{pct.toFixed(2)}%
      </td>
    </tr>
  );
}

export default function Positions({ positions, streamPrices }) {
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
          {positions.map((p) => (
            <PositionRow
              key={p.ticker}
              p={p}
              streamPrice={streamPrices?.[p.ticker]}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
