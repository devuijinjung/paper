import { useState, useMemo } from "react";
import { fmtKrw } from "../fmt";

const PAGE = 15;

const SIDE = {
  long:  { label: "롱",   cls: "pill-long"  },
  short: { label: "숏",   cls: "pill-short" },
  close: { label: "청산", cls: "pill-flat"  },
  buy:   { label: "롱",   cls: "pill-long"  },
  sell:  { label: "숏",   cls: "pill-short" },
};

const FILTERS = [
  { key: "all",   label: "전체" },
  { key: "long",  label: "롱" },
  { key: "short", label: "숏" },
  { key: "close", label: "청산" },
];

function MobileCard({ t, rate }) {
  const pnlPos = t.realized_pnl >= 0;
  const s = SIDE[t.side] ?? { label: t.side, cls: "pill-flat" };
  return (
    <div className="card card-hover p-3 text-xs space-y-2">
      <div className="flex items-center gap-2">
        <span className={`pill ${s.cls}`}>{s.label}</span>
        <span className="font-bold text-sm text-white">{t.ticker}</span>
        <span className="text-gray-600 ml-auto whitespace-nowrap font-mono">
          {new Date(t.ts).toLocaleString("ko",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-400 tabular-nums">{fmtKrw(t.price, rate)}</span>
        <span className={`font-bold tabular-nums ${t.realized_pnl === 0 ? "text-gray-600" : pnlPos ? "val-pos" : "val-neg"}`}>
          {t.realized_pnl === 0 ? "—" : fmtKrw(t.realized_pnl, rate, pnlPos)}
        </span>
      </div>
    </div>
  );
}

export default function Trades({ trades, rate }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "all") return trades ?? [];
    const norm = { long: ["long","buy"], short: ["short","sell"], close: ["close"] }[filter];
    return (trades ?? []).filter(t => norm.includes(t.side));
  }, [trades, filter]);

  if (!trades?.length)
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-1">
        <p className="text-sm">거래 내역이 없습니다</p>
      </div>
    );

  const totalPnl = filtered.reduce((s, t) => s + t.realized_pnl, 0);
  const start    = page * PAGE;
  const slice    = filtered.slice(start, start + PAGE);
  const pages    = Math.ceil(filtered.length / PAGE);

  const setF = (k) => { setFilter(k); setPage(0); };

  return (
    <div className="space-y-3">
      {/* Filters + summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-ink-800/60 border border-white/[0.05]">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setF(f.key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                filter === f.key ? "bg-white/[0.08] text-white" : "text-gray-500 hover:text-gray-300"
              }`}>{f.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">{filtered.length}건</span>
          <span className={`font-bold tabular-nums ${totalPnl >= 0 ? "val-pos" : "val-neg"}`}>
            {fmtKrw(totalPnl, rate, totalPnl >= 0)}
          </span>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {slice.map(t => <MobileCard key={t.id} t={t} rate={rate} />)}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["시각","종목","방향","체결가","수량","수수료","실현손익","전략"].map(h => (
                <th key={h} className="py-2.5 pr-4 text-left label">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map(t => {
              const pnlPos = t.realized_pnl >= 0;
              const s = SIDE[t.side] ?? { label: t.side, cls: "pill-flat" };
              return (
                <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 pr-4 text-gray-600 text-xs whitespace-nowrap font-mono">
                    {new Date(t.ts).toLocaleString("ko",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
                  </td>
                  <td className="py-2.5 pr-4 font-semibold text-white">{t.ticker}</td>
                  <td className="py-2.5 pr-4"><span className={`pill ${s.cls}`}>{s.label}</span></td>
                  <td className="py-2.5 pr-4 tabular-nums">{fmtKrw(t.price, rate)}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-gray-400">{t.qty.toFixed(6)}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-gray-500">{fmtKrw(t.fee, rate)}</td>
                  <td className={`py-2.5 pr-4 tabular-nums font-bold ${
                    t.realized_pnl === 0 ? "text-gray-600" : pnlPos ? "val-pos" : "val-neg"}`}>
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
        <div className="flex items-center justify-center gap-2 pt-1">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-ghost px-3 py-1.5 text-xs">← 이전</button>
          <span className="text-xs text-gray-500 px-2 tabular-nums">{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="btn-ghost px-3 py-1.5 text-xs">다음 →</button>
        </div>
      )}
    </div>
  );
}
