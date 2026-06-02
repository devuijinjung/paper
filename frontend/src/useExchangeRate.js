import { useState, useEffect } from "react";

export function useExchangeRate() {
  const [rate, setRate] = useState(1350);
  useEffect(() => {
    const poll = () =>
      fetch("/api/exchange-rate")
        .then(r => r.json())
        .then(d => { if (d.usd_to_krw) setRate(d.usd_to_krw); })
        .catch(() => {});
    poll();
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, []);
  return rate;
}
