import { useState } from "react";

function CopyRow({ label, url, color = "text-emerald-400" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex gap-2">
        <code className={`flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs ${color} break-all`}>
          {url}
        </code>
        <button
          onClick={copy}
          className="flex-shrink-0 px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg transition text-gray-300"
        >{copied ? "✓" : "복사"}</button>
      </div>
    </div>
  );
}

export default function Settings({ onReset }) {
  const [capital,   setCapital]   = useState("10000");
  const [fee,       setFee]       = useState("0.001");
  const [slip,      setSlip]      = useState("0.0005");
  const [msg,       setMsg]       = useState(null);
  const [confirm,   setConfirm]   = useState(false);

  // URL builder state
  const [urlTicker, setUrlTicker] = useState("BTCUSDT");
  const [urlSecret, setUrlSecret] = useState("");

  const origin     = window.location.origin;
  const base       = `${origin}/webhook`;
  const secretPart = urlSecret ? `&secret=${urlSecret}` : "&secret=YOUR_SECRET";
  const tickerPart = urlTicker ? `&ticker=${urlTicker.toUpperCase()}` : "&ticker=BTCUSDT";

  const buyUrl  = `${base}?action=buy${tickerPart}${secretPart}`;
  const sellUrl = `${base}?action=sell${tickerPart}${secretPart}`;

  const doReset = async () => {
    setConfirm(false);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initial_capital: parseFloat(capital),
          fee_rate:        parseFloat(fee),
          slippage:        parseFloat(slip),
        }),
      });
      setMsg({ text: res.ok ? "계좌가 초기화됐습니다." : "초기화 실패", ok: res.ok });
      if (res.ok) onReset?.();
    } catch {
      setMsg({ text: "서버 연결 오류", ok: false });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-lg">

      {/* ── URL 빌더 ── */}
      <div>
        <p className="label mb-1">웹훅 URL</p>
        <p className="text-xs text-gray-500 mb-3">
          URL 하나로 매수·매도 모두 처리합니다.
          알림 메시지에 <span className="text-emerald-400 font-mono">buy</span> 또는{" "}
          <span className="text-rose-400 font-mono">sell</span>만 입력하면 됩니다.
        </p>

        <div className="flex gap-2 mb-3">
          <input
            value={urlTicker}
            onChange={e => setUrlTicker(e.target.value.toUpperCase())}
            placeholder="티커 (예: BTCUSDT)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            value={urlSecret}
            onChange={e => setUrlSecret(e.target.value)}
            placeholder="웹훅 시크릿"
            type="text"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <CopyRow label="웹훅 URL (매수·매도 공용)" url={`${base}?ticker=${urlTicker || "BTCUSDT"}${secretPart}`} />

        <div className="mt-3 bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs space-y-1.5">
          <p className="text-gray-500 font-medium">TradingView 알림 메시지 설정</p>
          <div className="flex gap-3">
            <span className="text-gray-600">매수 알림:</span>
            <code className="text-emerald-400">buy</code>
          </div>
          <div className="flex gap-3">
            <span className="text-gray-600">매도 알림:</span>
            <code className="text-rose-400">sell</code>
          </div>
          <p className="text-gray-700 pt-1">long / short / close 등 다른 키워드도 사용 가능</p>
        </div>

        <p className="text-xs text-gray-600 mt-2">
          시크릿은 Render 대시보드 → Environment → WEBHOOK_SECRET 에서 확인하세요.
        </p>
      </div>

      {/* ── 매매 파라미터 ── */}
      <div className="border-t border-gray-800 pt-5">
        <p className="label mb-3">매매 파라미터</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "초기 자본 ($)", value: capital, set: setCapital, step: "1000" },
            { label: "수수료율",       value: fee,     set: setFee,     step: "0.0001" },
            { label: "슬리피지",       value: slip,    set: setSlip,    step: "0.0001" },
          ].map(({ label, value, set, step }) => (
            <label key={label} className="block">
              <span className="text-xs text-gray-500">{label}</span>
              <input
                type="number" step={step} value={value}
                onChange={e => set(e.target.value)}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
          ))}
        </div>
      </div>

      {/* ── 계좌 초기화 ── */}
      <div className="border-t border-gray-800 pt-5">
        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            className="bg-rose-600/20 border border-rose-600/40 hover:bg-rose-600/30
                       text-rose-400 text-sm font-semibold px-5 py-2 rounded-lg transition"
          >계좌 초기화</button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">정말 초기화할까요?</span>
            <button onClick={doReset}
              className="bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition">
              확인
            </button>
            <button onClick={() => setConfirm(false)}
              className="text-sm text-gray-500 hover:text-white px-4 py-1.5 rounded-lg bg-gray-800 transition">
              취소
            </button>
          </div>
        )}
        {msg && (
          <p className={`text-sm mt-3 ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
