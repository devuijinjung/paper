import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useWebSocket }     from "./useWebSocket";
import { useBinanceStream } from "./useBinanceStream";
import Summary    from "./components/Summary";
import Stats      from "./components/Stats";
import LiveTicker from "./components/LiveTicker";
import Positions  from "./components/Positions";
import Trades     from "./components/Trades";
import EquityCurve from "./components/EquityCurve";
import AlertLogs  from "./components/AlertLogs";
import Settings   from "./components/Settings";

const TABS = ["포지션", "거래내역", "자산곡선", "알림로그", "설정"];
const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

async function apiFetch(path) { return fetch(path).then(r => r.json()); }

export default function App() {
  const [portfolio,    setPortfolio]    = useState(null);
  const [trades,       setTrades]       = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [stats,        setStats]        = useState(null);
  const [streamPrices, setStreamPrices] = useState({});
  const [tab,          setTab]          = useState(0);
  const [wsStatus,     setWsStatus]     = useState("연결 중...");
  const alertPollRef = useRef(null);

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
    if (msg.type === "trade") load();
    if (msg.summary) setPortfolio(prev => prev ? { ...prev, ...msg.summary } : msg.summary);
  }, [load]);

  useWebSocket(WS_URL, onWsMessage, useCallback(() => setWsStatus("연결됨"), []));

  const handleTab = (i) => {
    setTab(i);
    if (i === 3) apiFetch("/api/alerts").then(setAlerts).catch(() => {});
    if (i === 1) apiFetch("/api/trades").then(setTrades).catch(() => {});
  };

  const connected = wsStatus === "연결됨";

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Paper Trading</h1>
          <p className="text-xs text-gray-600 mt-0.5">TradingView 웹훅 기반 모의매매</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
          <span className={`text-xs font-medium ${connected ? "text-emerald-400" : "text-gray-500"}`}>
            {wsStatus}
          </span>
        </div>
      </header>

      <LiveTicker data={streamPrices["BTCUSDT"]} />
      <Summary   portfolio={portfolio} streamPrices={streamPrices} />
      <Stats     stats={stats} />

      {/* ── Tabs ── */}
      <div className="mb-4 border-b border-gray-800">
        <div className="flex gap-1 pb-2 overflow-x-auto">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => handleTab(i)}
              className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === i ? "bg-emerald-600 text-white" : "text-gray-500 hover:text-white hover:bg-gray-800"
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-3 sm:p-5 min-h-48">
        {tab === 0 && <Positions  positions={portfolio?.positions} streamPrices={streamPrices} />}
        {tab === 1 && <Trades     trades={trades} />}
        {tab === 2 && <EquityCurve history={portfolio?.balance_history} />}
        {tab === 3 && <AlertLogs  logs={alerts} />}
        {tab === 4 && <Settings   onReset={load} />}
      </div>
    </div>
  );
}
