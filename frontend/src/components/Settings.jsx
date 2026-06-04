import { useState } from "react";
import { fmtKrw } from "../fmt";
import { useToast } from "../Toast";
import { IconCopy, IconCheck, IconRefresh, IconBolt } from "../icons";

function SectionHeader({ title, desc }) {
  return (
    <div className="pb-3 border-b border-ink-700 mb-4">
      <p className="text-sm font-semibold text-gray-200">{title}</p>
      {desc && <p className="text-xs text-gray-500 mt-1">{desc}</p>}
    </div>
  );
}

function CopyRow({ label, url }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      {label && <p className="text-xs text-gray-500 mb-1.5">{label}</p>}
      <div className="flex gap-2">
        <code className="flex-1 bg-ink-800 border border-ink-700 rounded px-3 py-2.5 text-xs text-up break-all font-mono">
          {url}
        </code>
        <button onClick={copy} className="btn-ghost px-3 shrink-0">
          {copied
            ? <IconCheck width={14} className="text-up" />
            : <IconCopy width={14} />}
        </button>
      </div>
    </div>
  );
}

export default function Settings({ onReset, rate }) {
  const [capital,  setCapital]  = useState(() => String(Math.round(10000 * rate)));
  const [fee,      setFee]      = useState("0.001");
  const [slip,     setSlip]     = useState("0.0005");
  const [confirm,  setConfirm]  = useState(false);
  const [urlTicker, setUrlTicker] = useState("BTCUSDT");
  const [urlSecret, setUrlSecret] = useState("");
  const toast = useToast();

  const base       = `${window.location.origin}/webhook`;
  const secretPart = urlSecret ? `&secret=${urlSecret}` : "&secret=시크릿";
  const webhookUrl = `${base}?ticker=${urlTicker || "BTCUSDT"}${secretPart}`;

  const doReset = async () => {
    setConfirm(false);
    try {
      const res = await fetch("/api/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initial_capital: parseFloat(capital) / rate,
          fee_rate: parseFloat(fee),
          slippage: parseFloat(slip),
        }),
      });
      if (res.ok) { toast("계좌가 초기화되었습니다", "success"); onReset?.(); }
      else         toast("초기화 실패", "error");
    } catch { toast("서버 연결 오류", "error"); }
  };

  return (
    <div className="space-y-8 max-w-xl">

      {/* Webhook URL */}
      <section>
        <SectionHeader
          title="웹훅 URL"
          desc="TradingView 알림에 이 URL을 붙여넣으세요. 롱·숏·청산을 모두 처리합니다."
        />
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={urlTicker} onChange={e => setUrlTicker(e.target.value.toUpperCase())}
              placeholder="티커 (BTCUSDT)" className="input flex-1 text-sm" />
            <input value={urlSecret} onChange={e => setUrlSecret(e.target.value)}
              placeholder="웹훅 시크릿" className="input flex-1 text-sm" />
          </div>
          <CopyRow url={webhookUrl} />

          {/* Signal mapping */}
          <div className="bg-ink-800 border border-ink-700 rounded p-3 text-xs space-y-1.5">
            <p className="text-gray-400 font-semibold mb-2">신호 매핑</p>
            <div className="space-y-1 text-gray-500">
              <p><code className="text-up">buy / long</code> → 롱 진입 (숏 보유 시 자동 청산 후 전환)</p>
              <p><code className="text-down">sell / short</code> → 숏 진입 (롱 보유 시 자동 청산 후 전환)</p>
              <p><code className="text-gray-400">close / exit</code> → 현재 포지션 청산</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trading parameters */}
      <section>
        <SectionHeader title="매매 파라미터" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs text-gray-500 block mb-1.5">초기 자본 (₩)</span>
            <input type="number" step="1000000" value={capital}
              onChange={e => setCapital(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 block mb-1.5">수수료율</span>
            <input type="number" step="0.0001" value={fee}
              onChange={e => setFee(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 block mb-1.5">슬리피지</span>
            <input type="number" step="0.0001" value={slip}
              onChange={e => setSlip(e.target.value)} className="input" />
          </label>
        </div>
      </section>

      {/* Reset */}
      <section>
        <SectionHeader title="계좌 초기화" desc="모든 거래 기록과 잔고가 삭제됩니다." />
        {!confirm ? (
          <button onClick={() => setConfirm(true)} className="btn-down px-5 py-2.5 rounded">
            <IconRefresh width={15} /> 계좌 초기화
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-400">정말 초기화하시겠습니까?</span>
            <button onClick={doReset}              className="btn-down px-4 py-2 rounded">확인</button>
            <button onClick={() => setConfirm(false)} className="btn-ghost px-4 py-2 rounded">취소</button>
          </div>
        )}
      </section>
    </div>
  );
}
