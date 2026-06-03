import { useState } from "react";
import { fmtKrw } from "../fmt";
import { useToast } from "../Toast";
import { IconCopy, IconCheck, IconUp, IconDown, IconClose, IconRefresh, IconBolt } from "../icons";

function Section({ title, desc, icon, children }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-bold text-gray-200">
          {icon} {title}
        </p>
        {desc && <p className="text-xs text-gray-500 mt-1">{desc}</p>}
      </div>
      {children}
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
        <code className="flex-1 bg-ink-950 border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-emerald-300 break-all font-mono">
          {url}
        </code>
        <button onClick={copy} className="btn-ghost px-3 shrink-0">
          {copied ? <IconCheck width={14} className="text-emerald-400" /> : <IconCopy width={14} />}
        </button>
      </div>
    </div>
  );
}

function TestTrade({ onDone, rate }) {
  const [ticker, setTicker] = useState("BTCUSDT");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(null);
  const toast = useToast();

  const send = async (action) => {
    if (!secret) { toast("웹훅 시크릿을 입력하세요", "error"); return; }
    setLoading(action);
    try {
      const res = await fetch(
        `/webhook?ticker=${encodeURIComponent(ticker)}&secret=${encodeURIComponent(secret)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }
      );
      const data = await res.json();
      if (res.ok) {
        const label = action === "buy" ? "롱 진입" : action === "sell" ? "숏 진입" : "청산";
        toast(`${label} 체결 @ ${fmtKrw(data.trade?.price, rate)}`, "success");
        onDone?.();
      } else {
        toast(data.detail ?? "주문 실패", "error");
      }
    } catch { toast("서버 연결 오류", "error"); }
    setLoading(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="티커" className="input w-32" />
        <input value={secret} onChange={e => setSecret(e.target.value)} placeholder="웹훅 시크릿" className="input flex-1" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => send("buy")} disabled={loading} className="btn-up py-2.5">
          <IconUp width={15} /> {loading === "buy" ? "…" : "롱"}
        </button>
        <button onClick={() => send("sell")} disabled={loading} className="btn-down py-2.5">
          <IconDown width={15} /> {loading === "sell" ? "…" : "숏"}
        </button>
        <button onClick={() => send("close")} disabled={loading} className="btn-ghost py-2.5">
          <IconClose width={15} /> {loading === "close" ? "…" : "청산"}
        </button>
      </div>
    </div>
  );
}

export default function Settings({ onReset, onTrade, rate }) {
  const [capital, setCapital] = useState(() => String(Math.round(10000 * rate)));
  const [fee,     setFee]     = useState("0.001");
  const [slip,    setSlip]    = useState("0.0005");
  const [confirm, setConfirm] = useState(false);
  const [urlTicker, setUrlTicker] = useState("BTCUSDT");
  const [urlSecret, setUrlSecret] = useState("");
  const toast = useToast();

  const base = `${window.location.origin}/webhook`;
  const secretPart = urlSecret ? `&secret=${urlSecret}` : "&secret=시크릿";
  const webhookUrl = `${base}?ticker=${urlTicker || "BTCUSDT"}${secretPart}`;

  const doReset = async () => {
    setConfirm(false);
    try {
      const res = await fetch("/api/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initial_capital: parseFloat(capital) / rate,
          fee_rate: parseFloat(fee), slippage: parseFloat(slip),
        }),
      });
      if (res.ok) { toast("계좌가 초기화되었습니다", "success"); onReset?.(); }
      else toast("초기화 실패", "error");
    } catch { toast("서버 연결 오류", "error"); }
  };

  return (
    <div className="space-y-7 max-w-xl">
      <Section title="웹훅 URL" icon={<IconBolt width={15} className="text-brand-400" />}
        desc="이 URL 하나로 롱·숏·청산을 모두 처리합니다. 알림 메시지는 기본값 그대로 두어도 됩니다.">
        <div className="flex gap-2">
          <input value={urlTicker} onChange={e => setUrlTicker(e.target.value.toUpperCase())} placeholder="티커 (BTCUSDT)" className="input flex-1" />
          <input value={urlSecret} onChange={e => setUrlSecret(e.target.value)} placeholder="웹훅 시크릿" className="input flex-1" />
        </div>
        <CopyRow url={webhookUrl} />
        <div className="bg-ink-950 border border-white/[0.05] rounded-xl p-3 text-xs space-y-1.5">
          <p className="text-gray-400 font-semibold">신호 매핑</p>
          <div className="grid grid-cols-1 gap-1 text-gray-500">
            <p><code className="text-emerald-400">buy / long</code> → 롱 진입 (숏 보유 시 자동 청산 후 전환)</p>
            <p><code className="text-rose-400">sell / short</code> → 숏 진입 (롱 보유 시 자동 청산 후 전환)</p>
            <p><code className="text-gray-300">close / exit</code> → 현재 포지션 청산</p>
          </div>
        </div>
      </Section>

      <div className="border-t border-white/[0.06] pt-6">
        <Section title="수동 주문" icon={<IconBolt width={15} className="text-amber-400" />}
          desc="TradingView 신호 없이 즉시 시장가로 주문을 실행합니다.">
          <TestTrade onDone={onTrade} rate={rate} />
        </Section>
      </div>

      <div className="border-t border-white/[0.06] pt-6">
        <Section title="매매 파라미터" icon={<IconRefresh width={15} className="text-gray-400" />}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500">초기 자본 (₩)</span>
              <input type="number" step="1000000" value={capital} onChange={e => setCapital(e.target.value)} className="input mt-1.5" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">수수료율</span>
              <input type="number" step="0.0001" value={fee} onChange={e => setFee(e.target.value)} className="input mt-1.5" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">슬리피지</span>
              <input type="number" step="0.0001" value={slip} onChange={e => setSlip(e.target.value)} className="input mt-1.5" />
            </label>
          </div>
        </Section>
      </div>

      <div className="border-t border-white/[0.06] pt-6">
        {!confirm ? (
          <button onClick={() => setConfirm(true)} className="btn-down px-5 py-2.5">
            <IconRefresh width={15} /> 계좌 초기화
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-400">모든 거래 기록이 삭제됩니다. 계속할까요?</span>
            <button onClick={doReset} className="btn-down px-4 py-2">확인</button>
            <button onClick={() => setConfirm(false)} className="btn-ghost px-4 py-2">취소</button>
          </div>
        )}
      </div>
    </div>
  );
}
