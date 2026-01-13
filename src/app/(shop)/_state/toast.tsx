"use client";

import { createContext, useContext, useMemo, useState } from "react";

const ToastContext = createContext<{ show: (message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const value = useMemo(() => {
    return {
      show: (nextMessage: string) => {
        setMessage(nextMessage);
        window.setTimeout(() => setMessage(null), 2200);
      },
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <div className="fixed left-1/2 top-4 z-50 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
