import { useFlash } from "../useFlash";
import { fmtKrw, fmtKrwCompact } from "../fmt";
import { IconUp, IconDown } from "../icons";

function Stat({ label, children }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-gray-600 uppercase tracking-wider">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{children}</span>
    </div>
  );
}

export default function LiveTicker({ data, rate }) {
  const price     = data?.price     ?? null;
  const changePct = data?.change_pct ?? null;
  const high      = data?.high       ?? null;
  const low       = data?.low        ?? null;
  const volume    = data?.volume     ?? null;
  const flashCls  = useFlash(price);
  const isPos     = (changePct ?? 0) >= 0;

  return (
    <div className="card p-4 sm:p-5 flex flex-wrap items-center gap-x-6 gap-y-4 relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-40 blur-3xl opacity-10 ${isPos ? "bg-emerald-500" : "bg-rose-500"}`} />

      <div className="flex items-center gap-3 relative">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500
                        grid place-items-center font-black text-ink-950 text-sm shrink-0">₿</div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400">BTC</span>
            <span className="text-[10px] text-gray-600">/ KRW</span>
          </div>
          {price ? (
            <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${flashCls}`}>
              {fmtKrw(price, rate)}
            </span>
          ) : (
            <span className="text-gray-600 text-sm animate-pulse">시세 연결 중…</span>
          )}
        </div>
      </div>

      {changePct !== null && (
        <span className={`inline-flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-xl relative ${
          isPos ? "bg-emerald-500/10 text-emerald-300 shadow-glow-up" : "bg-rose-500/10 text-rose-300 shadow-glow-down"
        }`}>
          {isPos ? <IconUp width={14} /> : <IconDown width={14} />}
          {Math.abs(changePct).toFixed(2)}%
          <span className="text-[10px] font-medium opacity-60 ml-0.5">24h</span>
        </span>
      )}

      <div className="flex items-center gap-5 sm:gap-7 relative ml-auto">
        {high && <Stat label="24h 고가"><span className="text-emerald-400">{fmtKrw(Number(high), rate)}</span></Stat>}
        {low  && <Stat label="24h 저가"><span className="text-rose-400">{fmtKrw(Number(low), rate)}</span></Stat>}
        {volume && (
          <div className="hidden md:block">
            <Stat label="24h 거래대금"><span className="text-gray-300">{fmtKrwCompact(volume, rate)}</span></Stat>
          </div>
        )}
      </div>
    </div>
  );
}
