import { useState, useMemo } from "react";
import { IconCheck, IconAlert, IconClose } from "../icons";

const META = {
  ok:       { cls: "text-up bg-up/10",          icon: <IconCheck width={10} />, label: "성공" },
  rejected: { cls: "text-brand-500 bg-brand-500/10", icon: <IconAlert width={10} />, label: "거부" },
  error:    { cls: "text-down bg-down/10",       icon: <IconClose width={10} />, label: "오류" },
};

function LogEntry({ log }) {
  const [open, setOpen] = useState(false);
  let payload = log.raw_payload;
  try { payload = JSON.stringify(JSON.parse(log.raw_payload), null, 2); } catch {}
  const m = META[log.status] ?? META.error;

  return (
    <div className="bg-ink-850 border border-ink-700 rounded-xl overflow-hidden hover:border-ink-600 transition-colors">
      <button className="w-full flex items-center gap-2.5 text-left p-3" onClick={() => setOpen(o => !o)}>
        <span className={`pill ${m.cls}`}>{m.icon}{m.label}</span>
        <span className="text-gray-500 flex-1 font-mono text-xs tabular-nums">
          {new Date(log.ts).toLocaleString("ko")}
        </span>
        <span className="text-gray-600 text-xs transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "" }}>▾</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5 animate-fade-up">
          <pre className="bg-ink-800 border border-ink-700 rounded p-2.5 text-xs text-gray-300
                          whitespace-pre-wrap break-all overflow-x-auto font-mono">
            {payload}
          </pre>
          {log.parsed_result && (
            <pre className="bg-ink-800 border border-ink-700 rounded p-2.5 text-xs text-gray-500
                            whitespace-pre-wrap break-all overflow-x-auto font-mono">
              {log.parsed_result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

const FILTERS = [
  { key: "all",      label: "전체" },
  { key: "ok",       label: "성공" },
  { key: "rejected", label: "거부" },
  { key: "error",    label: "오류" },
];

export default function AlertLogs({ logs }) {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(
    () => (filter === "all" ? logs : (logs ?? []).filter(l => l.status === filter)),
    [logs, filter]
  );

  if (!logs?.length)
    return <div className="flex items-center justify-center h-32 text-gray-600 text-sm">수신된 알림이 없습니다</div>;

  return (
    <div className="space-y-3">
      <div className="flex border border-ink-700 rounded overflow-hidden w-fit">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors
              ${filter === f.key
                ? "bg-brand-500 text-black"
                : "bg-ink-800 text-gray-500 hover:text-gray-300"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {filtered.map(log => <LogEntry key={log.id} log={log} />)}
      </div>
    </div>
  );
}
