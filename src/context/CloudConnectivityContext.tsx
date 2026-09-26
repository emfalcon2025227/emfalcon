import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../lib/firebase";

export type CloudConnectivityState = "ONLINE" | "OFFLINE" | "RECONNECTING";

let globalConnectivityState: CloudConnectivityState = typeof navigator !== "undefined" && navigator.onLine ? "ONLINE" : "OFFLINE";
const listeners = new Set<(state: CloudConnectivityState) => void>();

function setGlobalState(newState: CloudConnectivityState) {
  if (globalConnectivityState !== newState) {
    globalConnectivityState = newState;
    listeners.forEach(listener => listener(newState));
  }
}

const CloudConnectivityContext = createContext<CloudConnectivityState>("ONLINE");

export const CloudConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CloudConnectivityState>(globalConnectivityState);
  const unsubscribeHealthRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    listeners.add(setState);

    const handleOnline = () => {
      setGlobalState("RECONNECTING");
      checkConnection();
    };

    const handleOffline = () => {
      setGlobalState("OFFLINE");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Subscribe to Auth state: only run authorized _system_health onSnapshot when signed in
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeHealthRef.current) {
        try { unsubscribeHealthRef.current(); } catch (_) {}
        unsubscribeHealthRef.current = null;
      }

      if (!firebaseUser) {
        // Pre-auth / logged out: determine connectivity purely from network status without throwing permission errors
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setGlobalState("OFFLINE");
        } else {
          setGlobalState("ONLINE");
        }
        return;
      }

      // Authenticated user: attach authorized real-time health listener
      try {
        if (db && typeof doc === "function") {
          const pingRef = doc(db, "_system_health", "ping");
          unsubscribeHealthRef.current = onSnapshot(
            pingRef,
            { includeMetadataChanges: true },
            (snap) => {
              if (snap.metadata.fromCache) {
                if (typeof navigator !== "undefined" && !navigator.onLine) {
                  setGlobalState("OFFLINE");
                } else if (globalConnectivityState !== "ONLINE") {
                  setGlobalState("RECONNECTING");
                }
              } else {
                setGlobalState("ONLINE");
              }
            },
            (error) => {
              if (typeof navigator !== "undefined" && !navigator.onLine) {
                setGlobalState("OFFLINE");
              } else {
                // If browser is online, do not mark network OFFLINE due to health doc permissions
                console.warn("[CloudConnectivity] Health ping notice:", error?.message || error);
                setGlobalState("ONLINE");
              }
            }
          );
        }
      } catch (e) {
        console.warn("[CloudConnectivity] Could not attach Cloud Firestore health listener:", e);
      }
    });

    return () => {
      listeners.delete(setState);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribeAuth();
      if (unsubscribeHealthRef.current) {
        try { unsubscribeHealthRef.current(); } catch (_) {}
        unsubscribeHealthRef.current = null;
      }
    };
  }, []);

  return (
    <CloudConnectivityContext.Provider value={state}>
      {children}
    </CloudConnectivityContext.Provider>
  );
};

export const useCloudConnectivity = () => useContext(CloudConnectivityContext);

export function getCloudConnectivityState() {
  return globalConnectivityState;
}

export function checkConnection() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setGlobalState("OFFLINE");
    return;
  }
  setGlobalState("ONLINE");
}

export function assertCloudWriteAvailable(language: "ar" | "en") {
  if (globalConnectivityState === "OFFLINE" && typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      language === "ar" 
        ? "قاعدة البيانات السحابية غير متاحة حالياً (أنت غير متصل بالإنترنت). النظام في وضع القراءة فقط ولا يمكن تنفيذ العمليات المالية." 
        : "Cloud database is currently unavailable (offline). System is in Read-Only Mode and financial operations cannot be executed."
    );
  }
}
