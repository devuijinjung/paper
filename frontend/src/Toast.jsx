import { createContext, useContext, useState, useCallback } from "react";
import { IconCheck, IconAlert, IconBolt } from "./icons";

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

let _id = 0;

const STYLES = {
  success: { ring: "border-emerald-500/30", icon: <IconCheck width={16} className="text-emerald-400" />, bar: "bg-emerald-400" },
  error:   { ring: "border-rose-500/30",    icon: <IconAlert width={16} className="text-rose-400" />,    bar: "bg-rose-400" },
  info:    { ring: "border-brand-500/30",   icon: <IconBolt width={16} className="text-brand-400" />,    bar: "bg-brand-400" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((msg, type = "info", duration = 3500) => {
    const id = ++_id;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[min(92vw,360px)]">
        {toasts.map(t => {
          const s = STYLES[t.type] ?? STYLES.info;
          return (
            <div key={t.id}
              className={`card ${s.ring} px-4 py-3 flex items-start gap-3 animate-slide-in relative overflow-hidden`}>
              <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
              <span className="mt-0.5 shrink-0">{s.icon}</span>
              <p className="text-sm text-gray-200 leading-snug">{t.msg}</p>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
