import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useWebSocket }     from "./useWebSocket";
import { useBinanceStream } from "./useBinanceStream";
import { useExchangeRate }  from "./useExchangeRate";
import { useToast }         from "./Toast";
import { fmtKrw }           from "./fmt";
import Summary    from "./components/Summary";
import Stats      from "./components/Stats";
import LiveTicker from "./components/LiveTicker";
import Positions  from "./components/Positions";
import Trades     from "./components/Trades";
import EquityCurve from "./components/EquityCurve";
import AlertLogs  from "./components/AlertLogs";
import Settings   from "./components/Settings";
import { IconChart, IconList, IconWallet, IconBell, IconGear } from "./icons";

const TABS = [
  { name: "포지션",   icon: IconWallet },
  { name: "거래내역", icon: IconList },
  { name: "자산곡선", icon: IconChart },
  { name: "알림로그", icon: IconBell },
  { name: "설정",     icon: IconGear },
];
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

export default function App() {
  const [portfolio,    setPortfolio]    = useState(null);
  const [trades,       setTrades]       = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [stats,        setStats]        = useState(null);
  const [streamPrices, setStreamPrices] = useState({});
  const [tab,          setTab]          = useState(0);
  const [wsStatus,     setWsStatus]     = useState("connecting");
  const alertPollRef = useRef(null);
  const rate  = useExchangeRate();
  const toast = useToast();
  const now   = useClock();

  // ── Load all data ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [portfolio, trades, alerts, stats] = await Promise.all([
        apiFetch("/api/portfolio"),
        apiFetch("/api/trades"),
        apiFetch("/api/alerts"),
        apiFetch("/api/stats"),
      ]);
      setPortfolio(portfolio);
      setTrades(trades);
      setAlerts(alerts);
      setStats(stats);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // Alert tab polling
  useEffect(() => {
    if (tab === 3) {
      apiFetch("/api/alerts").then(setAlerts).catch(() => {});
      alertPollRef.current = setInterval(
        () => apiFetch("/api/alerts").then(setAlerts).catch(() => {}),
        10000
      );
    }
    return () => clearInterval(alertPollRef.current);
  }, [tab]);

  // ── Binance real-time stream ─────────────────────────────────────────────
  const streamSymbols = useMemo(() => {
    const tickers = portfolio?.positions?.map(p => p.ticker) ?? [];
    return [...new Set(["BTCUSDT", ...tickers])];
  }, [portfolio?.positions]);

  const onTick = useCallback(tick => {
    setStreamPrices(prev => ({ ...prev, [tick.symbol]: tick }));
  }, []);

  useBinanceStream(streamSymbols, onTick);

  // ── App WebSocket ────────────────────────────────────────────────────────
  const onWsMessage = useCallback(msg => {
    if (msg.type === "trade") {
      load();
      const t = msg.trade;
      if (t) {
        const sideLabel = t.side === "long" ? "롱 진입" : t.side === "short" ? "숏 진입" : "청산";
        const pnl = t.realized_pnl;
        const pnlTxt = pnl ? ` · 손익 ${fmtKrw(pnl, rate, pnl >= 0)}` : "";
        toast(`${sideLabel} 체결 @ ${fmtKrw(t.price, rate)}${pnlTxt}`,
              pnl < 0 ? "error" : "success");
      }
    }
    if (msg.summary) setPortfolio(prev => prev ? { ...prev, ...msg.summary } : msg.summary);
  }, [load, rate, toast]);

  useWebSocket(WS_URL, onWsMessage, useCallback(() => setWsStatus("connected"), []));

  const handleTab = (i) => {
    setTab(i);
    if (i === 3) apiFetch("/api/alerts").then(setAlerts).catch(() => {});
    if (i === 1) apiFetch("/api/trades").then(setTrades).catch(() => {});
  };

  const connected = wsStatus === "connected";

  return (
    <div className="min-h-screen">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-emerald-500
                            grid place-items-center font-black text-white text-sm shadow-glow">
              P
            </div>
            <div className="leading-none">
              <h1 className="text-base font-extrabold tracking-tight brand-text">Paper Futures</h1>
              <p className="text-[10px] text-gray-600 mt-0.5">TradingView 웹훅 모의 선물거래</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-gray-500 tabular-nums font-mono">
              {now.toLocaleTimeString("ko", { hour12: false })}
            </span>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold
              ${connected ? "bg-emerald-500/10 text-emerald-300" : "bg-gray-500/10 text-gray-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse-ring" : "bg-gray-600"}`} />
              {connected ? "실시간" : "연결 중"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 sm:p-5 space-y-5">
        <LiveTicker data={streamPrices["BTCUSDT"]} rate={rate} />
        <Summary   portfolio={portfolio} streamPrices={streamPrices} rate={rate} />
        <Stats     stats={stats} rate={rate} />

        {/* ── Tabs ── */}
        <div className="sticky top-14 z-30 -mx-3 sm:mx-0 px-3 sm:px-0 py-1 bg-ink-950/60 backdrop-blur">
          <div className="flex gap-1 overflow-x-auto card p-1.5">
            {TABS.map((t, i) => {
              const Icon = t.icon;
              return (
                <button key={t.name} onClick={() => handleTab(i)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    tab === i
                      ? "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_4px_16px_-6px_rgba(79,70,229,0.7)]"
                      : "text-gray-500 hover:text-white hover:bg-white/[0.05]"
                  }`}>
                  <Icon width={16} />
                  <span className="whitespace-nowrap">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card card-hover p-4 sm:p-5 min-h-[20rem] animate-fade-up">
          {tab === 0 && <Positions  positions={portfolio?.positions} streamPrices={streamPrices} rate={rate} onClosed={load} />}
          {tab === 1 && <Trades     trades={trades} rate={rate} />}
          {tab === 2 && <EquityCurve history={portfolio?.balance_history} rate={rate} />}
          {tab === 3 && <AlertLogs  logs={alerts} />}
          {tab === 4 && <Settings   onReset={load} onTrade={load} rate={rate} />}
        </div>

        <footer className="text-center text-[11px] text-gray-700 pt-2 pb-6">
          모의 거래 전용 · 실제 주문은 발생하지 않습니다 · 환율 ₩{Math.round(rate).toLocaleString()}/$
        </footer>
      </main>
    </div>
  );
}
