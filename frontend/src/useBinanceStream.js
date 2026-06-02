import { useEffect, useRef } from "react";

/**
 * Connects to Binance combined WebSocket stream for the given symbols.
 * onTick is called at most once per second per symbol with:
 * { symbol, price, change_pct, high, low, volume }
 */
export function useBinanceStream(symbols, onTick) {
  const onTickRef   = useRef(onTick);
  const lastEmit    = useRef({});
  const wsRef       = useRef(null);
  const retryTimer  = useRef(null);

  useEffect(() => { onTickRef.current = onTick; });

  // Recompute key only when the sorted symbol list actually changes
  const key = [...symbols].sort().join(",");

  useEffect(() => {
    if (!key) return;

    const streams = key
      .split(",")
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join("/");

    function connect() {
      const ws = new WebSocket(
        `wss://stream.binance.com:9443/stream?streams=${streams}`
      );
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const { data: d } = JSON.parse(e.data);
          if (!d?.s || !d?.c) return;

          // Throttle to 1 update per second per symbol
          const now = Date.now();
          if (now - (lastEmit.current[d.s] ?? 0) < 1000) return;
          lastEmit.current[d.s] = now;

          onTickRef.current({
            symbol:     d.s,
            price:      parseFloat(d.c),
            change_pct: parseFloat(d.P),
            high:       parseFloat(d.h),
            low:        parseFloat(d.l),
            volume:     parseFloat(d.q),
          });
        } catch {}
      };

      ws.onclose = () => {
        retryTimer.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      clearTimeout(retryTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [key]); // reconnect only when symbol set changes
}
