export function fmtKrw(usd, rate, showSign = false) {
  if (!rate || usd == null) return "—";
  const w = Math.round(usd * rate);
  const abs = Math.abs(w).toLocaleString("ko-KR");
  if (w < 0) return "-₩" + abs;
  return (showSign ? "+₩" : "₩") + abs;
}

export function fmtKrwCompact(usd, rate) {
  if (!rate || usd == null) return "—";
  const w = usd * rate;
  if (w >= 1e12) return "₩" + (w / 1e12).toFixed(1) + "조";
  if (w >= 1e8)  return "₩" + (w / 1e8).toFixed(0) + "억";
  return fmtKrw(usd, rate);
}
