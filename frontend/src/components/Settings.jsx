import { useState } from "react";

export default function Settings({ onReset }) {
  const [capital,  setCapital]  = useState("10000");
  const [fee,      setFee]      = useState("0.001");
  const [slip,     setSlip]     = useState("0.0005");
  const [msg,      setMsg]      = useState(null); // { text, ok }
  const [confirm,  setConfirm]  = useState(false);

  const webhookUrl = `${window.location.origin}/webhook`;

  const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

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
      {/* Webhook URL */}
      <div>
        <p className="label mb-2">웹훅 URL</p>
        <div className="flex gap-2">
          <code className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-emerald-400 truncate">
            {webhookUrl}
          </code>
          <button
            onClick={() => copy(webhookUrl)}
            className="px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg transition text-gray-300"
          >복사</button>
        </div>
      </div>

      {/* Parameters */}
      <div>
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

      {/* Reset */}
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
