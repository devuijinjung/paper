export default function AlertLogs({ logs }) {
  if (!logs?.length)
    return <p className="text-gray-500 text-sm py-4">수신된 알림 없음</p>;

  const badgeColor = (s) =>
    s === "ok" ? "bg-emerald-700 text-emerald-100"
    : s === "rejected" ? "bg-yellow-700 text-yellow-100"
    : "bg-rose-700 text-rose-100";

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {logs.map((log) => (
        <div key={log.id} className="bg-gray-800 rounded-lg p-3 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor(log.status)}`}>
              {log.status}
            </span>
            <span className="text-gray-400">{new Date(log.ts).toLocaleString("ko")}</span>
          </div>
          <pre className="text-gray-300 whitespace-pre-wrap break-all">
            {log.raw_payload}
          </pre>
          {log.parsed_result && (
            <pre className="text-gray-500 whitespace-pre-wrap break-all mt-1">
              {log.parsed_result}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
