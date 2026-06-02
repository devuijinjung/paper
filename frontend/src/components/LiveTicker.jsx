import { useFlash } from "../useFlash";

export default function LiveTicker({ data }) {
  const price     = data?.price     ?? null;
  const changePct = data?.change_pct ?? null;
  const high      = data?.high       ?? null;
  const low       = data?.low        ?? null;
  const volume    = data?.volume     ?? null;
  const flashCls  = useFlash(price);
  const isPos     = (changePct ?? 0) >= 0;

  return (
    <div className="card px-3 sm:px-5 py-2 sm:py-3 mb-4 flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2">
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="label">BTC / USDT</span>
        {price ? (
          <span className={`text-xl sm:text-2xl font-bold ${flashCls}`}>
            ${price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ) : (
          <span className="text-gray-600 text-sm animate-pulse">연결 중…</span>
        )}
      </div>

      {changePct !== null && (
        <span className={`text-sm font-bold px-2.5 py-0.5 rounded-lg ${
          isPos ? "bg-emerald-900/50 text-emerald-300" : "bg-rose-900/50 text-rose-300"
        }`}>
          {isPos ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
          <span className="text-xs font-normal ml-1 opacity-60">24h</span>
        </span>
      )}

      {high && low && (
        <div className="flex gap-5 text-xs text-gray-500">
          <span>고 <span className="text-emerald-400 font-medium">${Number(high).toLocaleString("en",{minimumFractionDigits:2})}</span></span>
          <span>저 <span className="text-rose-400 font-medium">${Number(low).toLocaleString("en",{minimumFractionDigits:2})}</span></span>
        </div>
      )}

      {volume && (
        <span className="text-xs text-gray-600 ml-auto hidden md:block">
          24h 거래량 <span className="text-gray-400">${(volume / 1e9).toFixed(2)}B</span>
        </span>
      )}
    </div>
  );
}
