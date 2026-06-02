import { useState } from "react";

export default function Settings({ onReset }) {
  const [capital, setCapital] = useState("10000");
  const [fee, setFee] = useState("0.001");
  const [slippage, setSlippage] = useState("0.0005");
  const [msg, setMsg] = useState("");

  const handleReset = async () => {
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initial_capital: parseFloat(capital),
          fee_rate: parseFloat(fee),
          slippage: parseFloat(slippage),
        }),
      });
      if (res.ok) {
        setMsg("계좌가 초기화되었습니다.");
        onReset?.();
      } else {
        setMsg("초기화 실패");
      }
    } catch {
      setMsg("서버 연결 오류");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "초기 자본 ($)", value: capital, set: setCapital },
          { label: "수수료율", value: fee, set: setFee },
          { label: "슬리피지", value: slippage, set: setSlippage },
        ].map(({ label, value, set }) => (
          <label key={label} className="block">
            <span className="text-xs text-gray-400">{label}</span>
            <input
              type="number"
              value={value}
              onChange={(e) => set(e.target.value)}
              className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
        ))}
      </div>
      <button
        onClick={handleReset}
        className="bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
      >
        계좌 초기화
      </button>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
    </div>
  );
}
