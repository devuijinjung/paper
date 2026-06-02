import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useWebSocket } from "./useWebSocket";
import { useBinanceStream } from "./useBinanceStream";
import Summary from "./components/Summary";
import LiveTicker from "./components/LiveTicker";
import Positions from "./components/Positions";
import Trades from "./components/Trades";
import EquityCurve from "./components/EquityCurve";
import AlertLogs from "./components/AlertLogs";
import Settings from "./components/Settings";

const TABS = ["포지션", "거래내역", "자산곡선", "알림로그", "설정"];

const WS_URL =
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

async function fetchAll() {
  const [portfolio, trades, alerts] = await Promise.all([
    fetch("/api/portfolio").then((r) => r.json()),
    fetch("/api/trades").then((r) => r.json()),
    fetch("/api/alerts").then((r) => r.json()),
  ]);
  return { portfolio, trades, alerts };
}

export default function App() {
  const [portfolio, setPortfolio]     = useState(null);
  const [trades, setTrades]           = useState([]);
  const [alerts, setAlerts]           = useState([]);
  const [streamPrices, setStreamPrices] = useState({});  // { BTCUSDT: {price, change_pct, ...} }
  const [tab, setTab]                 = useState(0);
  const [wsStatus, setWsStatus]       = useState("연결 중...");
  const alertPollRef                  = useRef(null);

  // ── Initial load ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const data = await fetchAll();
      setPortfolio(data.portfolio);
      setTrades(data.trades);
      setAlerts(data.alerts);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll alerts every 10 s while the alert tab is active
  useEffect(() => {
    if (tab === 3) {
      fetch("/api/alerts").then((r) => r.json()).then(setAlerts).catch(() => {});
      alertPollRef.current = setInterval(() => {
        fetch("/api/alerts").then((r) => r.json()).then(setAlerts).catch(() => {});
      }, 10000);
    }
    return () => clearInterval(alertPollRef.current);
  }, [tab]);

  // ── Binance real-time stream ───────────────────────────────────────────────
  // Always stream BTCUSDT + any open position tickers
  const streamSymbols = useMemo(() => {
    const tickers = portfolio?.positions?.map((p) => p.ticker) ?? [];
    return [...new Set(["BTCUSDT", ...tickers])];
  }, [portfolio?.positions]);

  const onTick = useCallback((tick) => {
    setStreamPrices((prev) => ({ ...prev, [tick.symbol]: tick }));
  }, []);

  useBinanceStream(streamSymbols, onTick);

  // ── App WebSocket (trades / position DB updates) ───────────────────────────
  const onWsMessage = useCallback((msg) => {
    if (msg.type === "trade") load();
    if (msg.summary) {
      setPortfolio((prev) => prev ? { ...prev, ...msg.summary } : msg.summary);
    }
  }, [load]);

  const onWsOpen = useCallback(() => setWsStatus("연결됨"), []);
  useWebSocket(WS_URL, onWsMessage, onWsOpen);

  const handleTabChange = (i) => {
    setTab(i);
    if (i === 3) fetch("/api/alerts").then((r) => r.json()).then(setAlerts).catch(() => {});
    if (i === 1) fetch("/api/trades").then((r) => r.json()).then(setTrades).catch(() => {});
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paper Trading</h1>
          <p className="text-xs text-gray-500 mt-0.5">TradingView 웹훅 기반 모의매매</p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
          wsStatus === "연결됨"
            ? "bg-emerald-900 text-emerald-300"
            : "bg-gray-700 text-gray-400"
        }`}>
          WS {wsStatus}
        </span>
      </header>

      <LiveTicker data={streamPrices["BTCUSDT"]} />
      <Summary portfolio={portfolio} streamPrices={streamPrices} />

      <nav className="flex gap-1 mb-4 border-b border-gray-800 pb-2">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => handleTabChange(i)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === i
                ? "bg-emerald-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="bg-gray-900 rounded-xl p-4 shadow-xl min-h-48">
        {tab === 0 && <Positions positions={portfolio?.positions} streamPrices={streamPrices} />}
        {tab === 1 && <Trades trades={trades} />}
        {tab === 2 && <EquityCurve history={portfolio?.balance_history} />}
        {tab === 3 && <AlertLogs logs={alerts} />}
        {tab === 4 && <Settings onReset={load} />}
      </div>
    </div>
  );
}
