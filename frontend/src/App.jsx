import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import Summary from "./components/Summary";
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

async function fetchAlerts() {
  return fetch("/api/alerts").then((r) => r.json());
}

export default function App() {
  const [portfolio, setPortfolio] = useState(null);
  const [trades, setTrades] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [tab, setTab] = useState(0);
  const [wsStatus, setWsStatus] = useState("연결 중...");
  const alertPollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchAll();
      setPortfolio(data.portfolio);
      setTrades(data.trades);
      setAlerts(data.alerts);
    } catch {
      // backend not yet ready
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll alerts every 10 s while the alert-log tab is active
  useEffect(() => {
    if (tab === 3) {
      fetchAlerts().then(setAlerts).catch(() => {});
      alertPollRef.current = setInterval(() => {
        fetchAlerts().then(setAlerts).catch(() => {});
      }, 10000);
    }
    return () => clearInterval(alertPollRef.current);
  }, [tab]);

  const onWsMessage = useCallback((msg) => {
    if (msg.summary) {
      setPortfolio((prev) => prev ? { ...prev, ...msg.summary } : msg.summary);
    }
    if (msg.positions) {
      setPortfolio((prev) => prev ? { ...prev, positions: msg.positions } : prev);
    }
    if (msg.type === "trade") {
      load();
    }
  }, [load]);

  const onWsOpen = useCallback(() => setWsStatus("연결됨"), []);

  useWebSocket(WS_URL, onWsMessage, onWsOpen);

  const handleTabChange = (i) => {
    setTab(i);
    // Immediately refresh relevant data on tab switch
    if (i === 3) fetchAlerts().then(setAlerts).catch(() => {});
    if (i === 1) fetch("/api/trades").then((r) => r.json()).then(setTrades).catch(() => {});
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paper Trading</h1>
          <p className="text-xs text-gray-500 mt-0.5">TradingView 웹훅 기반 모의매매</p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
          wsStatus === "연결됨" ? "bg-emerald-900 text-emerald-300" : "bg-gray-700 text-gray-400"
        }`}>
          WS {wsStatus}
        </span>
      </header>

      <Summary portfolio={portfolio} />

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
        {tab === 0 && <Positions positions={portfolio?.positions} />}
        {tab === 1 && <Trades trades={trades} />}
        {tab === 2 && <EquityCurve history={portfolio?.balance_history} />}
        {tab === 3 && <AlertLogs logs={alerts} />}
        {tab === 4 && <Settings onReset={load} />}
      </div>
    </div>
  );
}
