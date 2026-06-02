import { useFlash } from "../useFlash";

function Row({ p, sp }) {
  const live    = sp?.price ?? p.current_price;
  const pnl     = (live - p.avg_price) * p.qty;
  const pct     = p.avg_price > 0 ? ((live - p.avg_price) / p.avg_price) * 100 : 0;
  const isPos   = pnl >= 0;
  const priceF  = useFlash(live);
  const pnlF    = useFlash(pnl);

  return (
    <tr className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
      <td className="py-3 pr-4 font-semibold text-white">{p.ticker}</td>
      <td className="py-3 pr-4 tabular-nums text-gray-300">{p.qty.toFixed(6)}</td>
      <td className="py-3 pr-4 tabular-nums text-gray-300">${p.avg_price.toLocaleString("en",{minimumFractionDigits:2})}</td>
      <td className={`py-3 pr-4 tabular-nums font-medium ${priceF}`}>
        ${live.toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}
      </td>
      <td className={`py-3 pr-4 tabular-nums font-medium ${isPos?"val-pos":"val-neg"} ${pnlF}`}>
        {isPos?"+":""}{pnl.toFixed(2)}
      </td>
      <td className={`py-3 tabular-nums font-medium ${isPos?"val-pos":"val-neg"}`}>
        {isPos?"+":""}{pct.toFixed(2)}%
      </td>
    </tr>
  );
}

export default function Positions({ positions, streamPrices }) {
  if (!positions?.length)
    return <div className="flex items-center justify-center h-32 text-gray-600">보유 포지션 없음</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {["종목","수량","평단가","현재가","평가손익","수익률"].map(h => (
              <th key={h} className="py-2 pr-4 text-left label">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map(p => (
            <Row key={p.ticker} p={p} sp={streamPrices?.[p.ticker]} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
