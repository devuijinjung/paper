import { useState, useMemo } from "react";
import { fmtKrw } from "../fmt";
import { useToast } from "../Toast";

/* ── Account Stats ─────────────────────────────────────── */
function AccountStats({ portfolio, streamPrices, stats, rate }) {
  const positions  = portfolio?.positions ?? [];
  const cash       = portfolio?.cash ?? 0;
  const dbEquity   = portfolio?.equity ?? cash;
  const dbRet      = portfolio?.total_return_pct ?? 0;

  const liveEquity = useMemo(() => {
    return positions.reduce((s, p) => {
      const live = streamPrices?.[p.ticker]?.price ?? p.current_price;
      const upnl = p.side === "short"
        ? (p.avg_price - live) * p.qty
        : (live - p.avg_price) * p.qty;
      return s + p.avg_price * p.qty + upnl;
    }, cash);
  }, [cash, positions, streamPrices]);

  const initial = dbEquity && dbRet !== undefined
    ? dbEquity / (1 + dbRet / 100)
    : 10000;
  const liveRet = initial > 0 ? ((liveEquity / initial) - 1) * 100 : 0;
  const isPos   = liveRet >= 0;
  const pnl     = liveEquity - initial;

  return (
    <div className="p-4 space-y-4">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">계좌 현황</p>

      {/* Main equity display */}
      <div>
        <p className="text-[11px] text-gray-600 mb-1">총 평가자산</p>
        <p className="text-2xl font-bold font-mono tabular-nums text-gray-100">
          {portfolio ? fmtKrw(liveEquity, rate) : <span className="skeleton inline-block h-7 w-36" />}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-sm font-bold tabular-nums ${isPos ? "text-up" : "text-down"}`}>
            {isPos ? "+" : ""}{liveRet.toFixed(2)}%
          </span>
          <span className={`text-xs tabular-nums ${isPos ? "text-up/60" : "text-down/60"}`}>
            {isPos ? "+" : ""}{fmtKrw(pnl, rate)}
          </span>
        </div>
      </div>

      {/* 2×2 stat grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: "가용 증거금",  val: portfolio ? fmtKrw(cash, rate)                              : null, mono: true },
          { label: "승률",         val: portfolio ? `${(portfolio.win_rate ?? 0).toFixed(1)}%`      : null, color: "text-brand-500" },
          { label: "총 거래",      val: stats     ? `${stats.total_trades}건`                       : null },
          { label: "손익비",       val: stats?.profit_factor ? `${stats.profit_factor.toFixed(2)}×` : null,
            color: stats?.profit_factor >= 1.5 ? "text-up" : stats?.profit_factor > 0 ? "text-brand-500" : undefined },
        ].map(({ label, val, color, mono }) => (
          <div key={label} className="bg-ink-800 rounded p-2.5">
            <p className="text-[10px] text-gray-600 mb-1">{label}</p>
            {val
              ? <p className={`text-sm font-bold tabular-nums ${mono ? "font-mono" : ""} ${color ?? "text-gray-200"}`}>{val}</p>
              : <div className="skeleton h-4 w-14" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Order Form ─────────────────────────────────────────── */
function OrderForm({ rate, onTrade }) {
  const [ticker,  setTicker]  = useState("BTCUSDT");
  const [secret,  setSecret]  = useState("");
  const [side,    setSide]    = useState("buy");
  const [loading, setLoading] = useState(null);
  const toast = useToast();

  const send = async (action) => {
    if (!secret) { toast("웹훅 시크릿을 입력하세요", "error"); return; }
    setLoading(action);
    try {
      const res = await fetch(
        `/webhook?ticker=${encodeURIComponent(ticker)}&secret=${encodeURIComponent(secret)}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }) }
      );
      const data = await res.json();
      if (res.ok) {
        const label = action === "buy" ? "롱 진입" : action === "sell" ? "숏 진입" : "청산";
        toast(`${label} 체결 @ ${fmtKrw(data.trade?.price, rate)}`, "success");
        onTrade?.();
      } else {
        toast(data.detail ?? "주문 실패", "error");
      }
    } catch { toast("서버 연결 오류", "error"); }
    setLoading(null);
  };

  return (
    <div className="p-4 space-y-3">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">수동 주문</p>

      {/* Long / Short tab */}
      <div className="flex rounded overflow-hidden border border-ink-700">
        <button onClick={() => setSide("buy")}
          className={`flex-1 py-2.5 text-sm font-bold transition-colors
            ${side === "buy"
              ? "bg-up text-black"
              : "bg-ink-800 text-gray-500 hover:text-up"}`}>
          롱 매수
        </button>
        <button onClick={() => setSide("sell")}
          className={`flex-1 py-2.5 text-sm font-bold transition-colors
            ${side === "sell"
              ? "bg-down text-white"
              : "bg-ink-800 text-gray-500 hover:text-down"}`}>
          숏 매도
        </button>
      </div>

      {/* Inputs */}
      <div>
        <label className="text-[11px] text-gray-500 block mb-1">종목</label>
        <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
          className="input text-xs" placeholder="BTCUSDT" />
      </div>
      <div>
        <label className="text-[11px] text-gray-500 block mb-1">웹훅 시크릿</label>
        <input value={secret} onChange={e => setSecret(e.target.value)}
          type="password" className="input text-xs" placeholder="••••••" />
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between text-gray-600">
          <span>주문 유형</span><span className="text-gray-400">시장가</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>주문 수량</span><span className="text-brand-500 font-semibold">가용 잔고 100%</span>
        </div>
      </div>

      {/* Submit button */}
      {side === "buy" ? (
        <button onClick={() => send("buy")} disabled={!!loading}
          className="w-full btn-up py-3 text-sm font-bold rounded">
          {loading === "buy" ? "처리 중…" : "롱 진입 (매수)"}
        </button>
      ) : (
        <button onClick={() => send("sell")} disabled={!!loading}
          className="w-full btn-down py-3 text-sm font-bold rounded">
          {loading === "sell" ? "처리 중…" : "숏 진입 (매도)"}
        </button>
      )}

      <button onClick={() => send("close")} disabled={!!loading}
        className="w-full btn-ghost py-2 text-xs rounded">
        {loading === "close" ? "청산 중…" : "전체 포지션 청산"}
      </button>
    </div>
  );
}

/* ── Exports ─────────────────────────────────────────────── */

/** compact=true → mobile horizontal stats strip only */
export function MobileAccountBar({ portfolio, streamPrices, rate }) {
  const positions = portfolio?.positions ?? [];
  const cash      = portfolio?.cash ?? 0;
  const dbEquity  = portfolio?.equity ?? cash;
  const dbRet     = portfolio?.total_return_pct ?? 0;

  const liveEquity = useMemo(() => {
    return positions.reduce((s, p) => {
      const live = streamPrices?.[p.ticker]?.price ?? p.current_price;
      const upnl = p.side === "short"
        ? (p.avg_price - live) * p.qty
        : (live - p.avg_price) * p.qty;
      return s + p.avg_price * p.qty + upnl;
    }, cash);
  }, [cash, positions, streamPrices]);

  const initial = dbEquity && dbRet !== undefined ? dbEquity / (1 + dbRet / 100) : 10000;
  const liveRet = initial > 0 ? ((liveEquity / initial) - 1) * 100 : 0;
  const isPos   = liveRet >= 0;

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border-b border-ink-700 bg-ink-900 text-xs overflow-x-auto">
      <div className="shrink-0">
        <span className="text-gray-600">평가자산 </span>
        <span className="font-bold font-mono tabular-nums text-gray-200">
          {portfolio ? fmtKrw(liveEquity, rate) : "—"}
        </span>
      </div>
      <div className="shrink-0">
        <span className="text-gray-600">수익률 </span>
        <span className={`font-bold tabular-nums ${isPos ? "text-up" : "text-down"}`}>
          {isPos ? "+" : ""}{liveRet.toFixed(2)}%
        </span>
      </div>
      <div className="shrink-0">
        <span className="text-gray-600">증거금 </span>
        <span className="font-mono tabular-nums text-gray-300">{portfolio ? fmtKrw(cash, rate) : "—"}</span>
      </div>
      <div className="shrink-0">
        <span className="text-gray-600">승률 </span>
        <span className="text-brand-500 font-semibold">{portfolio ? `${(portfolio.win_rate ?? 0).toFixed(1)}%` : "—"}</span>
      </div>
    </div>
  );
}

export default function OrderPanel({ portfolio, streamPrices, stats, rate, onTrade }) {
  return (
    <div className="flex flex-col">
      <AccountStats portfolio={portfolio} streamPrices={streamPrices} stats={stats} rate={rate} />
      <div className="border-t border-ink-700" />
      <OrderForm rate={rate} onTrade={onTrade} />
    </div>
  );
}
