import { useEffect, useRef, useState } from "react";

/** Returns a CSS class ("flash-up" | "flash-down" | "") whenever `value` changes. */
export function useFlash(value) {
  const prev = useRef(null);
  const [cls, setCls] = useState("");

  useEffect(() => {
    if (prev.current === null) { prev.current = value; return; }
    if (prev.current === value) return;
    const up = value > prev.current;
    prev.current = value;
    setCls(up ? "flash-up" : "flash-down");
    const t = setTimeout(() => setCls(""), 900);
    return () => clearTimeout(t);
  }, [value]);

  return cls;
}
