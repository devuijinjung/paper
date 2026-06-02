import { useState } from "react";

const badge = (s) =>
  s === "ok"       ? "bg-emerald-900/60 text-emerald-300 border-emerald-800/50"
  : s === "rejected" ? "bg-yellow-900/60 text-yellow-300 border-yellow-800/50"
  : "bg-rose-900/60 text-rose-300 border-rose-800/50";

function LogEntry({ log }) {
  const [open, setOpen] = useState(false);
  let payload = log.raw_payload;
  try {
    payload = JSON.stringify(JSON.parse(log.raw_payload), null, 2);
  } catch {}

  return (
    <div className="card p-3 text-xs">
      <button
        className="w-full flex items-center gap-2 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className={`px-2 py-0.5 rounded-md border font-semibold text-xs ${badge(log.status)}`}>
          {log.status}
        </span>
        <span className="text-gray-500 flex-1">
          {new Date(log.ts).toLocaleString("ko")}
        </span>
        <span className="text-gray-600">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          <pre className="bg-gray-950 rounded-lg p-2 text-gray-300 whitespace-pre-wrap break-all overflow-x-auto">
            {payload}
          </pre>
          {log.parsed_result && (
            <pre className="bg-gray-950 rounded-lg p-2 text-gray-500 whitespace-pre-wrap break-all overflow-x-auto">
              {log.parsed_result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlertLogs({ logs }) {
  if (!logs?.length)
    return <div className="flex items-center justify-center h-32 text-gray-600">수신된 알림 없음</div>;

  return (
    <div className="space-y-2 max-h-[60vh] md:max-h-[480px] overflow-y-auto pr-1">
      {logs.map(log => <LogEntry key={log.id} log={log} />)}
    </div>
  );
}
