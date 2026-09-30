import React, { useState, useEffect, createContext, useContext } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  timestamp: number;
}

interface NotificationContextProps {
  showToast: (title: string, message: string, type?: ToastType) => void;
}

const NotificationContext = createContext<NotificationContextProps>({
  showToast: () => {},
});

export const useGlobalNotifications = () => useContext(NotificationContext);

export const GlobalNotificationManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (title: string, message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, title, message, type, timestamp: Date.now() };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const handleGlobalToastEvent = (e: any) => {
      if (e.detail && e.detail.message) {
        showToast(
          e.detail.title || "System Notification",
          e.detail.message,
          e.detail.type || "info"
        );
      }
    };
    window.addEventListener("show-global-toast", handleGlobalToastEvent);
    return () => window.removeEventListener("show-global-toast", handleGlobalToastEvent);
  }, []);

  return (
    <NotificationContext.Provider value={{ showToast }}>
      {children}
      {/* Floating Toast Container */}
      <aside aria-label="Notifications" className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          const isSuccess = toast.type === "success";
          const isError = toast.type === "error";
          const isWarning = toast.type === "warning";

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
                isSuccess
                  ? "bg-emerald-950/90 text-emerald-100 border-emerald-500/40"
                  : isError
                  ? "bg-rose-950/90 text-rose-100 border-rose-500/40"
                  : isWarning
                  ? "bg-amber-950/90 text-amber-100 border-amber-500/40"
                  : "bg-slate-950/90 text-slate-100 border-slate-700/80"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {isError && <XCircle className="w-5 h-5 text-rose-400" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {toast.type === "info" && <Info className="w-5 h-5 text-sky-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm tracking-tight">{toast.title}</h4>
                <p className="text-xs opacity-90 mt-0.5 leading-relaxed break-words">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 opacity-70 hover:opacity-100 transition p-1 -mr-1 -mt-1 rounded-lg hover:bg-white/10"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </aside>
    </NotificationContext.Provider>
  );
};
