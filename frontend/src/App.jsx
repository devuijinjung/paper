import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useWebSocket }     from "./useWebSocket";
import { useBinanceStream } from "./useBinanceStream";
import { useExchangeRate }  from "./useExchangeRate";
import { useToast }         from "./Toast";
import { fmtKrw }           from "./fmt";
import Positions   from "./components/Positions";
import Trades      from "./components/Trades";
import Stats       from "./components/Stats";
import EquityCurve from "./components/EquityCurve";
import AlertLogs   from "./components/AlertLogs";
import Settings    from "./components/Settings";
import OrderPanel, { MobileAccountBar } from "./components/OrderPanel";

const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

async function apiFetch(path) { return fetch(path).then(r => r.json()); }

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function MarketBar({ data, rate }) {
  const price  = data?.price;
  const change = data?.change_pct;
  const isPos  = (change ?? 0) >= 0;
  return (
    <div className="flex items-center gap-5 px-4 overflow-x-auto min-w-0">
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold text-gray-300">BTC/USDT</span>
        <span className={`text-lg font-bold font-mono tabular-nums ${isPos ? "text-up" : "text-down"}`}>
          {price ? `$${price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
        </span>
        {change !== undefined && change !== null && (
          <span className={`text-xs font-semibold shrink-0 ${isPos ? "text-up" : "text-down"}`}>
            {isPos ? "+" : ""}{change.toFixed(2)}%
          </span>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-5 text-xs text-gray-600 shrink-0">
        {data?.high   && <span>고가 <span className="text-gray-400 font-mono">${Number(data.high).toLocaleString()}</span></span>}
        {data?.low    && <span>저가 <span className="text-gray-400 font-mono">${Number(data.low).toLocaleString()}</span></span>}
        {data?.volume && <span className="hidden md:inline">
          24H Vol <span className="text-gray-400 font-mono">{(data.volume / 1e6).toFixed(2)}M</span>
        </span>}
        {rate && <span className="hidden lg:inline">₩{Math.round(rate).toLocaleString()}/$</span>}
      </div>
    </div>
  );
}

const TABS = [
  { key: "pos",      label: "포지션"   },
  { key: "trades",   label: "거래내역" },
  { key: "stats",    label: "성과분석" },
  { key: "chart",    label: "자산곡선" },
  { key: "alerts",   label: "알림로그" },
  { key: "settings", label: "설정"     },
];

export default function App() {
  const [portfolio,    setPortfolio]    = useState(null);
  const [trades,       setTrades]       = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [stats,        setStats]        = useState(null);
  const [streamPrices, setStreamPrices] = useState({});
  const [tab,          setTab]          = useState("pos");
  const [wsStatus,     setWsStatus]     = useState("connecting");
  const alertPollRef = useRef(null);
  const rate  = useExchangeRate();
  const toast = useToast();
  const now   = useClock();

  const load = useCallback(async () => {
    try {
      const [p, t, a, s] = await Promise.all([
        apiFetch("/api/portfolio"),
        apiFetch("/api/trades"),
        apiFetch("/api/alerts"),
        apiFetch("/api/stats"),
      ]);
      setPortfolio(p);
      setTrades(t);
      setAlerts(a);
      setStats(s);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === "alerts") {
      apiFetch("/api/alerts").then(setAlerts).catch(() => {});
      alertPollRef.current = setInterval(
        () => apiFetch("/api/alerts").then(setAlerts).catch(() => {}),
        10000
      );
    }
    return () => clearInterval(alertPollRef.current);
  }, [tab]);

  const streamSymbols = useMemo(() => {
    const tickers = portfolio?.positions?.map(p => p.ticker) ?? [];
    return [...new Set(["BTCUSDT", ...tickers])];
  }, [portfolio?.positions]);

  const onTick = useCallback(tick => {
    setStreamPrices(prev => ({ ...prev, [tick.symbol]: tick }));
  }, []);

  useBinanceStream(streamSymbols, onTick);

  const onWsMessage = useCallback(msg => {
    if (msg.type === "trade") {
      load();
      const t = msg.trade;
      if (t) {
        const sideLabel = t.side === "long" ? "롱 진입" : t.side === "short" ? "숏 진입" : "청산";
        const pnl       = t.realized_pnl;
        const pnlTxt    = pnl ? ` · 손익 ${fmtKrw(pnl, rate, pnl >= 0)}` : "";
        toast(`${sideLabel} 체결 @ ${fmtKrw(t.price, rate)}${pnlTxt}`,
              pnl < 0 ? "error" : "success");
      }
    }
    if (msg.summary) setPortfolio(prev => prev ? { ...prev, ...msg.summary } : msg.summary);
  }, [load, rate, toast]);

  useWebSocket(WS_URL, onWsMessage, useCallback(() => setWsStatus("connected"), []));

  const handleTab = (k) => {
    setTab(k);
    if (k === "alerts") apiFetch("/api/alerts").then(setAlerts).catch(() => {});
    if (k === "trades") apiFetch("/api/trades").then(setTrades).catch(() => {});
  };

  const btcData   = streamPrices["BTCUSDT"];
  const connected = wsStatus === "connected";

  return (
    <div className="h-screen flex flex-col bg-ink-950 overflow-hidden">

      {/* ── Top Navigation ── */}
      <header className="h-14 shrink-0 flex items-center border-b border-ink-700 bg-ink-900 z-40">
        {/* Logo block */}
        <div className="flex items-center gap-2.5 px-4 border-r border-ink-700 h-full shrink-0">
          <div className="w-7 h-7 rounded bg-brand-500 grid place-items-center font-black text-black text-sm select-none">
            P
          </div>
          <span className="font-bold text-gray-100 text-sm hidden sm:block tracking-tight">Paper Futures</span>
        </div>

        {/* Market stats */}
        <div className="flex-1 min-w-0">
          <MarketBar data={btcData} rate={rate} />
        </div>

        {/* Right: clock + connection */}
        <div className="flex items-center gap-3 px-4 shrink-0">
          <span className="hidden md:block text-xs text-gray-600 font-mono tabular-nums">
            {now.toLocaleTimeString("ko", { hour12: false })}
          </span>
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold border
            ${connected
              ? "border-up/25 bg-up/8 text-up"
              : "border-ink-700 bg-ink-800 text-gray-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0
              ${connected ? "bg-up animate-pulse-ring" : "bg-gray-600"}`} />
            <span className="hidden sm:inline">{connected ? "실시간" : "연결 중"}</span>
          </div>
        </div>
      </header>

      {/* ── Exchange Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left Sidebar (desktop ≥ lg) ── */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-ink-700 bg-ink-900 overflow-y-auto">
          <OrderPanel
            portfolio={portfolio}
            streamPrices={streamPrices}
            stats={stats}
            rate={rate}
            onTrade={load}
          />
        </aside>

        {/* ── Right Content ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Mobile account bar */}
          <div className="lg:hidden shrink-0">
            <MobileAccountBar portfolio={portfolio} streamPrices={streamPrices} rate={rate} />
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-ink-700 bg-ink-900 overflow-x-auto shrink-0">
            {TABS.map(t => (
              <button key={t.key} onClick={() => handleTab(t.key)}
                className={`ex-tab ${tab === t.key ? "ex-tab-active" : ""}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-4 animate-fade-up">
            {tab === "pos"      && <Positions positions={portfolio?.positions} streamPrices={streamPrices} rate={rate} onClosed={load} />}
            {tab === "trades"   && <Trades    trades={trades} rate={rate} />}
            {tab === "stats"    && <Stats     stats={stats} rate={rate} />}
            {tab === "chart"    && <EquityCurve history={portfolio?.balance_history} rate={rate} />}
            {tab === "alerts"   && <AlertLogs logs={alerts} />}
            {tab === "settings" && <Settings  onReset={load} onTrade={load} rate={rate} />}
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-gray-700 py-1.5 border-t border-ink-700 bg-ink-900 shrink-0">
            모의 거래 전용 · 실제 주문 없음 · ₩{Math.round(rate).toLocaleString()}/$
          </div>
        </div>
      </div>
    </div>
  );
}
