import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export type CloudConnectivityState = "ONLINE" | "OFFLINE" | "RECONNECTING";

let globalConnectivityState: CloudConnectivityState = typeof navigator !== "undefined" && navigator.onLine ? "ONLINE" : "OFFLINE";
const listeners = new Set<(state: CloudConnectivityState) => void>();

function setGlobalState(newState: CloudConnectivityState) {
  if (globalConnectivityState !== newState) {
    globalConnectivityState = newState;
    listeners.forEach(listener => listener(newState));
  }
}

let isInitialized = false;

const CloudConnectivityContext = createContext<CloudConnectivityState>("ONLINE");

export const CloudConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CloudConnectivityState>(globalConnectivityState);

  useEffect(() => {
    listeners.add(setState);

    if (!isInitialized) {
      isInitialized = true;
      
      const handleOnline = () => {
        setGlobalState("RECONNECTING");
      };
      
      const handleOffline = () => {
        setGlobalState("OFFLINE");
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Listen to a non-existent or dummy doc just to check fromCache metadata
      let unsubscribeHealth = () => {};
      try {
        if (db && typeof doc === "function") {
          const pingRef = doc(db, "_system_health", "ping");
          unsubscribeHealth = onSnapshot(
            pingRef,
            { includeMetadataChanges: true },
            (snap) => {
              if (snap.metadata.fromCache) {
                 setGlobalState("OFFLINE");
              } else {
                 setGlobalState("ONLINE");
              }
            },
            (error) => {
              console.warn("Firestore connection check note:", error?.message || error);
              setGlobalState("OFFLINE");
            }
          );
        }
      } catch (e) {
        console.warn("Could not attach Cloud Firestore health listener:", e);
      }

      // In development, strict mode might re-run this, but our isInitialized flag protects it.
    }

    return () => {
      listeners.delete(setState);
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

export function assertCloudWriteAvailable(language: "ar" | "en") {
  if (globalConnectivityState !== "ONLINE") {
    throw new Error(
      language === "ar" 
        ? "قاعدة البيانات السحابية غير متاحة حالياً. النظام في وضع القراءة فقط ولا يمكن تنفيذ العمليات المالية." 
        : "Cloud database is currently unavailable. System is in Read-Only Mode and financial operations cannot be executed."
    );
  }
}
