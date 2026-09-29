import { useCallback, useEffect, useRef, useState } from "react";

/** Returns [toast, showToast]; render <Toast toast={toast} /> once on the page. */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((message, variant = "success") => {
    clearTimeout(timer.current);
    setToast({ message, variant });
    timer.current = setTimeout(() => setToast(null), variant === "error" ? 6000 : 4000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return [toast, showToast];
}

export default function Toast({ toast }) {
  if (!toast) return null;
  const error = toast.variant === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`fixed bottom-6 right-6 z-[60] max-w-sm rounded-[10px] border px-4 py-3 text-sm shadow-lg ${
        error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
      }`}
    >
      {toast.message}
    </div>
  );
}
