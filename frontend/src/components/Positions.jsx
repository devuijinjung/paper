import { useState } from "react";
import { useFlash } from "../useFlash";
import { fmtKrw } from "../fmt";
import { useToast } from "../Toast";
import { IconUp, IconDown, IconClose } from "../icons";

function usePositionData(p, sp) {
  const live = sp?.price ?? p.current_price;
  const pnl  = p.side === "short"
    ? (p.avg_price - live) * p.qty
    : (live - p.avg_price) * p.qty;
  const notional = p.avg_price * p.qty;
  const pct  = notional > 0 ? (pnl / notional) * 100 : 0;
  return { live, pnl, pct, notional, isPos: pnl >= 0 };
}

function SideBadge({ side }) {
  const isLong = side === "long";
  return (
    <span className={`pill ${isLong ? "pill-long" : "pill-short"}`}>
      {isLong ? <IconUp width={10} /> : <IconDown width={10} />}
      {isLong ? "LONG" : "SHORT"}
    </span>
  );
}

function useCloser(onClosed) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const close = async (ticker) => {
    setBusy(ticker);
    try {
      const res  = await fetch(`/api/close/${encodeURIComponent(ticker)}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const pnl = data.trade?.realized_pnl ?? 0;
        toast(`${ticker} 청산 완료`, pnl >= 0 ? "success" : "error");
        onClosed?.();
      } else {
        toast(data.detail ?? "청산 실패", "error");
      }
    } catch {
      toast("서버 연결 오류", "error");
    }
    setBusy(null);
  };
  return { busy, close };
}

/* ── Mobile card ── */
function MobileCard({ p, sp, rate, onClose, busy }) {
  const { live, pnl, pct, isPos } = usePositionData(p, sp);
  const priceF = useFlash(live);
  const pnlF   = useFlash(pnl);

  return (
    <div className="bg-ink-850 border border-ink-700 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SideBadge side={p.side} />
          <span className="font-bold text-white text-sm">{p.ticker}</span>
        </div>
        <span className={`font-bold tabular-nums text-right text-sm ${isPos ? "text-up" : "text-down"} ${pnlF}`}>
          {fmtKrw(pnl, rate, isPos)}
          <span className="block text-[11px] font-medium opacity-70">
            {isPos ? "+" : ""}{pct.toFixed(2)}%
          </span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-gray-600 mb-0.5">수량</p>
          <p className="text-gray-300 tabular-nums font-mono">{p.qty.toFixed(6)}</p>
        </div>
        <div>
          <p className="text-gray-600 mb-0.5">진입가</p>
          <p className="text-gray-300 tabular-nums font-mono">{fmtKrw(p.avg_price, rate)}</p>
        </div>
        <div>
          <p className="text-gray-600 mb-0.5">현재가</p>
          <p className={`text-gray-200 tabular-nums font-mono ${priceF}`}>{fmtKrw(live, rate)}</p>
        </div>
      </div>

      <button onClick={() => onClose(p.ticker)} disabled={busy === p.ticker}
        className="w-full btn-ghost py-2 text-xs rounded">
        <IconClose width={12} />
        {busy === p.ticker ? "청산 중…" : "시장가 청산"}
      </button>
    </div>
  );
}

/* ── Desktop table row ── */
function TableRow({ p, sp, rate, onClose, busy }) {
  const { live, pnl, pct, isPos } = usePositionData(p, sp);
  const priceF = useFlash(live);
  const pnlF   = useFlash(pnl);

  return (
    <tr className="border-b border-ink-700 hover:bg-ink-800/40 transition-colors">
      <td className="py-3 pr-6"><SideBadge side={p.side} /></td>
      <td className="py-3 pr-6 font-semibold text-gray-100">{p.ticker}</td>
      <td className="py-3 pr-6 tabular-nums text-gray-300 font-mono">{p.qty.toFixed(6)}</td>
      <td className="py-3 pr-6 tabular-nums text-gray-300 font-mono">{fmtKrw(p.avg_price, rate)}</td>
      <td className={`py-3 pr-6 tabular-nums font-mono ${priceF}`}>{fmtKrw(live, rate)}</td>
      <td className={`py-3 pr-6 tabular-nums font-bold ${isPos ? "text-up" : "text-down"} ${pnlF}`}>
        {fmtKrw(pnl, rate, isPos)}
      </td>
      <td className={`py-3 pr-6 tabular-nums font-semibold ${isPos ? "text-up" : "text-down"}`}>
        {isPos ? "+" : ""}{pct.toFixed(2)}%
      </td>
      <td className="py-3 text-right">
        <button onClick={() => onClose(p.ticker)} disabled={busy === p.ticker}
          className="px-3 py-1.5 rounded text-xs font-semibold border border-down/40 text-down
                     hover:bg-down/10 transition-colors disabled:opacity-40">
          {busy === p.ticker ? "…" : "청산"}
        </button>
      </td>
    </tr>
  );
}

/* ── Empty state ── */
function Empty() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-600 gap-2">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.2" className="opacity-30">
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        <path d="M16 12h.01M3 9h14" />
      </svg>
      <p className="text-sm">보유 중인 포지션이 없습니다</p>
      <p className="text-xs text-gray-700">사이드바에서 주문하거나 TradingView 신호를 연결하세요</p>
    </div>
  );
}

export default function Positions({ positions, streamPrices, rate, onClosed }) {
  const { busy, close } = useCloser(onClosed);

  if (!positions?.length) return <Empty />;

  return (
    <>
      {/* Mobile */}
      <div className="space-y-2.5 md:hidden">
        {positions.map(p => (
          <MobileCard key={p.ticker} p={p} sp={streamPrices?.[p.ticker]}
            rate={rate} onClose={close} busy={busy} />
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-700">
              {["방향", "종목", "수량", "진입가", "현재가", "평가손익", "수익률", ""].map((h, i) => (
                <th key={i}
                  className={`py-3 pr-6 text-xs font-medium text-gray-500 uppercase tracking-wide
                    ${i === 7 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(p => (
              <TableRow key={p.ticker} p={p} sp={streamPrices?.[p.ticker]}
                rate={rate} onClose={close} busy={busy} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
