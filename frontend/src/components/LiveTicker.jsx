import { useEffect, useRef, useState, useCallback } from "react";
import { useFlash } from "../useFlash";

const BINANCE_24H = "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT";

export default function LiveTicker({ wsMarket }) {
  const [market, setMarket] = useState(null);
  const intervalRef = useRef(null);

  const fetchMarket = useCallback(async () => {
    try {
      const d = await fetch(BINANCE_24H).then((r) => r.json());
      if (d?.lastPrice) {
        setMarket({
          price: parseFloat(d.lastPrice),
          change_pct: parseFloat(d.priceChangePercent),
          high: parseFloat(d.highPrice),
          low: parseFloat(d.lowPrice),
          volume: parseFloat(d.quoteVolume),
        });
      }
    } catch {}
  }, []);

  // Fetch from Binance directly on mount, then every 10 s
  useEffect(() => {
    fetchMarket();
    intervalRef.current = setInterval(fetchMarket, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchMarket]);

  // WebSocket overrides with the freshest price when available
  useEffect(() => {
    if (wsMarket?.price) {
      setMarket((prev) => prev ? { ...prev, price: wsMarket.price } : wsMarket);
    }
  }, [wsMarket]);

  const price = market?.price ?? null;
  const changePct = market?.change_pct ?? null;
  const high = market?.high ?? null;
  const low = market?.low ?? null;
  const volume = market?.volume ?? null;

  const flashCls = useFlash(price);
  const isPos = (changePct ?? 0) >= 0;

  return (
    <div className="bg-gray-800/80 border border-gray-700 rounded-2xl px-5 py-3 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="flex items-baseline gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-xs font-semibold text-gray-400 tracking-wider">BTC / USDT</span>
        </div>
        {price ? (
          <span className={`text-2xl font-bold tabular-nums ${flashCls}`}>
            ${price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ) : (
          <span className="text-gray-500 text-sm animate-pulse">로딩 중…</span>
        )}
      </div>

      {changePct !== null && (
        <span className={`text-sm font-bold px-2.5 py-0.5 rounded-lg tabular-nums ${
          isPos ? "bg-emerald-900/70 text-emerald-300" : "bg-rose-900/70 text-rose-300"
        }`}>
          {isPos ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
          <span className="text-xs font-normal ml-1 opacity-70">24h</span>
        </span>
      )}

      {high && low && (
        <div className="flex gap-4 text-xs text-gray-400">
          <span>고 <span className="text-emerald-400 tabular-nums font-medium">
            ${Number(high).toLocaleString("en", { minimumFractionDigits: 2 })}
          </span></span>
          <span>저 <span className="text-rose-400 tabular-nums font-medium">
            ${Number(low).toLocaleString("en", { minimumFractionDigits: 2 })}
          </span></span>
        </div>
      )}

      {volume && (
        <span className="text-xs text-gray-500 hidden sm:block">
          거래량 <span className="text-gray-300">${(volume / 1e6).toFixed(1)}M</span>
        </span>
      )}
    </div>
  );
}
