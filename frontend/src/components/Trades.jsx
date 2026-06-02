import { useState } from "react";
import { fmtKrw } from "../fmt";

const PAGE = 20;

function MobileCard({ t, rate }) {
  const pnlPos = t.realized_pnl >= 0;
  return (
    <div className="card p-3 text-xs space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={`font-bold ${t.side === "buy" ? "text-emerald-400" : "text-rose-400"}`}>
          {t.side === "buy" ? "매수" : "매도"}
        </span>
        <span className="font-semibold text-sm text-white">{t.ticker}</span>
        <span className="text-gray-500 ml-auto whitespace-nowrap">
          {new Date(t.ts).toLocaleString("ko",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-400 tabular-nums">{fmtKrw(t.price, rate)}</span>
        <span className={`font-semibold tabular-nums ${
          t.realized_pnl === 0 ? "text-gray-600" : pnlPos ? "val-pos" : "val-neg"
        }`}>
          {t.realized_pnl === 0 ? "—" : fmtKrw(t.realized_pnl, rate, pnlPos)}
        </span>
      </div>
    </div>
  );
}

export default function Trades({ trades, rate }) {
  const [page, setPage] = useState(0);

  if (!trades?.length)
    return <div className="flex items-center justify-center h-32 text-gray-600">거래 내역 없음</div>;

  const totalPnl = trades.reduce((s, t) => s + t.realized_pnl, 0);
  const start    = page * PAGE;
  const slice    = trades.slice(start, start + PAGE);
  const pages    = Math.ceil(trades.length / PAGE);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-1 text-sm">
        <span className="text-gray-500">총 {trades.length}건</span>
        <span className={`font-semibold tabular-nums ${totalPnl >= 0 ? "val-pos" : "val-neg"}`}>
          실현손익 {fmtKrw(totalPnl, rate, totalPnl >= 0)}
        </span>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {slice.map(t => <MobileCard key={t.id} t={t} rate={rate} />)}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {["시각","종목","방향","체결가","수량","수수료","실현손익","전략"].map(h => (
                <th key={h} className="py-2 pr-4 text-left label">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map(t => {
              const pnlPos = t.realized_pnl >= 0;
              return (
                <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 pr-4 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(t.ts).toLocaleString("ko",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
                  </td>
                  <td className="py-2.5 pr-4 font-medium">{t.ticker}</td>
                  <td className={`py-2.5 pr-4 font-bold text-xs px-2 rounded ${
                    t.side === "buy" ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {t.side === "buy" ? "매수" : "매도"}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">{fmtKrw(t.price, rate)}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-gray-400">{t.qty.toFixed(6)}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-gray-500">{fmtKrw(t.fee, rate)}</td>
                  <td className={`py-2.5 pr-4 tabular-nums font-medium ${
                    t.realized_pnl === 0 ? "text-gray-600"
                    : pnlPos ? "val-pos" : "val-neg"
                  }`}>
                    {t.realized_pnl === 0 ? "—" : fmtKrw(t.realized_pnl, rate, pnlPos)}
                  </td>
                  <td className="py-2.5 text-gray-600 text-xs">{t.strategy ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-xs rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition"
          >← 이전</button>
          <span className="text-xs text-gray-500">{page + 1} / {pages}</span>
          <button
            disabled={page >= pages - 1}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-xs rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition"
          >다음 →</button>
        </div>
      )}
    </div>
  );
}
