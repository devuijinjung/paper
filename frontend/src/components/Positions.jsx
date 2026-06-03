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
  const long = side === "long";
  return (
    <span className={`pill ${long ? "pill-long" : "pill-short"}`}>
      {long ? <IconUp width={11} /> : <IconDown width={11} />}
      {long ? "롱" : "숏"}
    </span>
  );
}

function useCloser(onClosed) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const close = async (ticker) => {
    setBusy(ticker);
    try {
      const res = await fetch(`/api/close/${encodeURIComponent(ticker)}`, { method: "POST" });
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

function MobileCard({ p, sp, rate, onClose, busy }) {
  const { live, pnl, pct, isPos } = usePositionData(p, sp);
  const priceF = useFlash(live);
  const pnlF   = useFlash(pnl);

  return (
    <div className="card card-hover p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SideBadge side={p.side} />
          <span className="font-bold text-white">{p.ticker}</span>
        </div>
        <span className={`font-extrabold tabular-nums text-right ${isPos ? "val-pos" : "val-neg"} ${pnlF}`}>
          {fmtKrw(pnl, rate, isPos)}
          <span className="block text-[11px] font-semibold opacity-70">({isPos ? "+" : ""}{pct.toFixed(2)}%)</span>
        </span>
      </div>
      <div className="grid grid-cols-3 text-xs gap-x-2">
        <div><p className="text-gray-600 mb-0.5">수량</p><p className="text-gray-300 tabular-nums">{p.qty.toFixed(6)}</p></div>
        <div><p className="text-gray-600 mb-0.5">진입가</p><p className="text-gray-300 tabular-nums">{fmtKrw(p.avg_price, rate)}</p></div>
        <div><p className="text-gray-600 mb-0.5">현재가</p><p className={`text-gray-200 tabular-nums ${priceF}`}>{fmtKrw(live, rate)}</p></div>
      </div>
      <button onClick={() => onClose(p.ticker)} disabled={busy === p.ticker}
        className="btn-down w-full py-1.5 text-xs">
        <IconClose width={13} /> {busy === p.ticker ? "청산 중…" : "시장가 청산"}
      </button>
    </div>
  );
}

function TableRow({ p, sp, rate, onClose, busy }) {
  const { live, pnl, pct, isPos } = usePositionData(p, sp);
  const priceF = useFlash(live);
  const pnlF   = useFlash(pnl);

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <td className="py-3 pr-4"><SideBadge side={p.side} /></td>
      <td className="py-3 pr-4 font-bold text-white">{p.ticker}</td>
      <td className="py-3 pr-4 tabular-nums text-gray-300">{p.qty.toFixed(6)}</td>
      <td className="py-3 pr-4 tabular-nums text-gray-300">{fmtKrw(p.avg_price, rate)}</td>
      <td className={`py-3 pr-4 tabular-nums font-medium ${priceF}`}>{fmtKrw(live, rate)}</td>
      <td className={`py-3 pr-4 tabular-nums font-bold ${isPos?"val-pos":"val-neg"} ${pnlF}`}>{fmtKrw(pnl, rate, isPos)}</td>
      <td className={`py-3 pr-4 tabular-nums font-bold ${isPos?"val-pos":"val-neg"}`}>{isPos?"+":""}{pct.toFixed(2)}%</td>
      <td className="py-3 text-right">
        <button onClick={() => onClose(p.ticker)} disabled={busy === p.ticker}
          className="btn-down px-3 py-1.5 text-xs">
          <IconClose width={12} /> {busy === p.ticker ? "…" : "청산"}
        </button>
      </td>
    </tr>
  );
}

export default function Positions({ positions, streamPrices, rate, onClosed }) {
  const { busy, close } = useCloser(onClosed);

  if (!positions?.length)
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-600 gap-2">
        <IconWalletPlaceholder />
        <p className="text-sm">보유 중인 포지션이 없습니다</p>
        <p className="text-xs text-gray-700">TradingView 신호 또는 설정 탭에서 주문하세요</p>
      </div>
    );

  return (
    <>
      <div className="space-y-2.5 md:hidden">
        {positions.map(p => (
          <MobileCard key={p.ticker} p={p} sp={streamPrices?.[p.ticker]} rate={rate} onClose={close} busy={busy} />
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["방향","종목","수량","진입가","현재가","평가손익","수익률",""].map((h, i) => (
                <th key={i} className={`py-2.5 pr-4 label ${i === 7 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(p => (
              <TableRow key={p.ticker} p={p} sp={streamPrices?.[p.ticker]} rate={rate} onClose={close} busy={busy} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function IconWalletPlaceholder() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.3" className="opacity-40">
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M16 12h.01M3 9h14" />
    </svg>
  );
}
