import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "./AuthContext";

interface ElementPosition {
  x: number;
  y: number;
}

interface LayoutData {
  [elementId: string]: ElementPosition;
}

interface LayoutContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  layouts: Record<string, LayoutData>;
  updatePosition: (formId: string, elementId: string, position: ElementPosition) => void;
  saveLayout: (formId: string) => Promise<void>;
  resetLayout: (formId: string) => Promise<void>;
  loadLayout: (formId: string) => Promise<void>;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [layouts, setLayouts] = useState<Record<string, LayoutData>>({});
  const [loadedForms, setLoadedForms] = useState<Set<string>>(new Set());

  const toggleEditMode = () => {
    if (currentUser?.role === "SYSTEM_OWNER" || currentUser?.role === "SUPER_ADMIN") {
      setIsEditMode((prev) => !prev);
    }
  };

  const updatePosition = (formId: string, elementId: string, position: ElementPosition) => {
    setLayouts((prev) => ({
      ...prev,
      [formId]: {
        ...(prev[formId] || {}),
        [elementId]: position,
      },
    }));
  };

  const loadLayout = async (formId: string) => {
    if (loadedForms.has(formId)) return;
    setLoadedForms((prev) => new Set(prev).add(formId));

    // Try loading from localStorage first
    try {
      const cached = localStorage.getItem(`form_layout_${formId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          setLayouts((prev) => ({
            ...prev,
            [formId]: parsed,
          }));
        }
      }
    } catch (e) {
      // Ignore localStorage parse errors
    }

    try {
      const docRef = doc(db, "form_layouts", formId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const layoutData = data.layouts || {};
        setLayouts((prev) => ({
          ...prev,
          [formId]: layoutData,
        }));
        try {
          localStorage.setItem(`form_layout_${formId}`, JSON.stringify(layoutData));
        } catch (e) {}
      }
    } catch (error: any) {
      // Suppress noisy console.error for quota limit exceeded / network error
      console.warn(`Layout for ${formId} could not be fetched from cloud (using local/default layout):`, error?.message || error);
    }
  };

  const saveLayout = async (formId: string) => {
    if (!currentUser) return;
    const currentLayout = layouts[formId] || {};

    try {
      localStorage.setItem(`form_layout_${formId}`, JSON.stringify(currentLayout));
    } catch (e) {}

    try {
      const docRef = doc(db, "form_layouts", formId);
      await setDoc(docRef, {
        formId,
        layouts: currentLayout,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.id,
      });
      console.log(`Layout for ${formId} saved.`);
    } catch (error: any) {
      console.warn(`Saved layout locally for ${formId} (cloud sync unavailable):`, error?.message || error);
    }
  };

  const resetLayout = async (formId: string) => {
    try {
      localStorage.removeItem(`form_layout_${formId}`);
    } catch (e) {}

    setLayouts((prev) => {
      const next = { ...prev };
      delete next[formId];
      return next;
    });

    try {
      const docRef = doc(db, "form_layouts", formId);
      await deleteDoc(docRef);
      console.log(`Layout for ${formId} reset.`);
    } catch (error: any) {
      console.warn(`Reset layout locally for ${formId}:`, error?.message || error);
    }
  };

  return (
    <LayoutContext.Provider
      value={{
        isEditMode,
        toggleEditMode,
        layouts,
        updatePosition,
        saveLayout,
        resetLayout,
        loadLayout,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
};
