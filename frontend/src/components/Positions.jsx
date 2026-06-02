import { useFlash } from "../useFlash";
import { fmtKrw } from "../fmt";

function usePositionData(p, sp) {
  const live = sp?.price ?? p.current_price;
  const pnl  = p.side === "long"
    ? (live - p.avg_price) * p.qty
    : (p.avg_price - live) * p.qty;
  const pct  = p.avg_price > 0 ? (pnl / (p.avg_price * p.qty)) * 100 : 0;
  return { live, pnl, pct, isPos: pnl >= 0 };
}

function SideBadge({ side }) {
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
      side === "long"
        ? "bg-emerald-900/60 text-emerald-400"
        : "bg-rose-900/60 text-rose-400"
    }`}>
      {side === "long" ? "롱" : "숏"}
    </span>
  );
}

function MobileCard({ p, sp, rate }) {
  const { live, pnl, pct, isPos } = usePositionData(p, sp);
  const priceF = useFlash(live);
  const pnlF   = useFlash(pnl);

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SideBadge side={p.side} />
          <span className="font-semibold text-white">{p.ticker}</span>
        </div>
        <span className={`font-bold tabular-nums ${isPos ? "val-pos" : "val-neg"} ${pnlF}`}>
          {fmtKrw(pnl, rate, isPos)}
          <span className="text-xs ml-1.5 opacity-70">({isPos ? "+" : ""}{pct.toFixed(2)}%)</span>
        </span>
      </div>
      <div className="grid grid-cols-3 text-xs gap-x-2">
        <div>
          <p className="text-gray-600 mb-0.5">수량</p>
          <p className="text-gray-300 tabular-nums">{p.qty.toFixed(6)}</p>
        </div>
        <div>
          <p className="text-gray-600 mb-0.5">진입가</p>
          <p className="text-gray-300 tabular-nums">{fmtKrw(p.avg_price, rate)}</p>
        </div>
        <div>
          <p className="text-gray-600 mb-0.5">현재가</p>
          <p className={`text-gray-200 tabular-nums ${priceF}`}>
            {fmtKrw(live, rate)}
          </p>
        </div>
      </div>
    </div>
  );
}

function TableRow({ p, sp, rate }) {
  const { live, pnl, pct, isPos } = usePositionData(p, sp);
  const priceF = useFlash(live);
  const pnlF   = useFlash(pnl);

  return (
    <tr className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
      <td className="py-3 pr-4"><SideBadge side={p.side} /></td>
      <td className="py-3 pr-4 font-semibold text-white">{p.ticker}</td>
      <td className="py-3 pr-4 tabular-nums text-gray-300">{p.qty.toFixed(6)}</td>
      <td className="py-3 pr-4 tabular-nums text-gray-300">{fmtKrw(p.avg_price, rate)}</td>
      <td className={`py-3 pr-4 tabular-nums font-medium ${priceF}`}>
        {fmtKrw(live, rate)}
      </td>
      <td className={`py-3 pr-4 tabular-nums font-medium ${isPos?"val-pos":"val-neg"} ${pnlF}`}>
        {fmtKrw(pnl, rate, isPos)}
      </td>
      <td className={`py-3 tabular-nums font-medium ${isPos?"val-pos":"val-neg"}`}>
        {isPos?"+":""}{pct.toFixed(2)}%
      </td>
    </tr>
  );
}

export default function Positions({ positions, streamPrices, rate }) {
  if (!positions?.length)
    return <div className="flex items-center justify-center h-32 text-gray-600">보유 포지션 없음</div>;

  return (
    <>
      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        {positions.map(p => (
          <MobileCard key={p.ticker} p={p} sp={streamPrices?.[p.ticker]} rate={rate} />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {["방향","종목","수량","진입가","현재가","평가손익","수익률"].map(h => (
                <th key={h} className="py-2 pr-4 text-left label">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(p => (
              <TableRow key={p.ticker} p={p} sp={streamPrices?.[p.ticker]} rate={rate} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
