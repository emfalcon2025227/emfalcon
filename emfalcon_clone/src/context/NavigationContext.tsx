import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ViewState } from "../types";

export type OverlayType = "property360" | "unit360" | "tenant360" | "owner360";

export interface NavOverlay {
  type: OverlayType;
  id: string;
}

export interface NavTarget {
  view: ViewState;
  overlay?: NavOverlay | null;
}

interface NavigationContextType {
  currentNav: NavTarget;
  currentView: ViewState;
  selectedPropertyIdFor360: string | null;
  selectedUnitIdFor360: string | null;
  selectedTenantIdFor360: string | null;
  selectedOwnerIdFor360: string | null;
  canGoBack: boolean;
  historyStack: NavTarget[];
  navigateTo: (view: ViewState, options?: { replace?: boolean; overlay?: NavOverlay | null }) => void;
  open360: (type: OverlayType, id: string) => void;
  closeCurrent360: () => void;
  goBack: () => void;
  resetToView: (view: ViewState) => void;
  setSelectedPropertyIdFor360: (id: string | null) => void;
  setSelectedUnitIdFor360: (id: string | null) => void;
  setSelectedTenantIdFor360: (id: string | null) => void;
  setSelectedOwnerIdFor360: (id: string | null) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode; defaultView?: ViewState }> = ({
  children,
  defaultView = "DASHBOARD",
}) => {
  const [historyStack, setHistoryStack] = useState<NavTarget[]>([
    { view: defaultView, overlay: null },
  ]);

  const currentNav = historyStack[historyStack.length - 1] || { view: defaultView, overlay: null };
  const currentView = currentNav.view;

  const selectedPropertyIdFor360 =
    currentNav.overlay?.type === "property360" ? currentNav.overlay.id : null;
  const selectedUnitIdFor360 =
    currentNav.overlay?.type === "unit360" ? currentNav.overlay.id : null;
  const selectedTenantIdFor360 =
    currentNav.overlay?.type === "tenant360" ? currentNav.overlay.id : null;
  const selectedOwnerIdFor360 =
    currentNav.overlay?.type === "owner360" ? currentNav.overlay.id : null;

  const canGoBack = historyStack.length > 1;

  // Helper to check if two NavTargets are identical
  const isSameTarget = (a: NavTarget, b: NavTarget) => {
    if (a.view !== b.view) return false;
    if (!a.overlay && !b.overlay) return true;
    if (a.overlay && b.overlay) {
      return a.overlay.type === b.overlay.type && a.overlay.id === b.overlay.id;
    }
    return false;
  };

  const navigateTo = useCallback(
    (view: ViewState, options?: { replace?: boolean; overlay?: NavOverlay | null }) => {
      const nextTarget: NavTarget = { view, overlay: options?.overlay || null };

      setHistoryStack((prev) => {
        const top = prev[prev.length - 1];
        if (top && isSameTarget(top, nextTarget)) {
          return prev; // Prevent duplicate entries
        }
        if (options?.replace && prev.length > 0) {
          return [...prev.slice(0, prev.length - 1), nextTarget];
        }
        return [...prev, nextTarget];
      });
    },
    []
  );

  const open360 = useCallback(
    (type: OverlayType, id: string) => {
      setHistoryStack((prev) => {
        const top = prev[prev.length - 1] || { view: defaultView };
        const nextTarget: NavTarget = {
          view: top.view,
          overlay: { type, id },
        };
        if (top && isSameTarget(top, nextTarget)) {
          return prev;
        }
        return [...prev, nextTarget];
      });
    },
    [defaultView]
  );

  const goBack = useCallback(() => {
    setHistoryStack((prev) => {
      if (prev.length <= 1) {
        // Fallback to default view if history is exhausted
        return [{ view: defaultView, overlay: null }];
      }
      return prev.slice(0, prev.length - 1);
    });
  }, [defaultView]);

  const closeCurrent360 = useCallback(() => {
    setHistoryStack((prev) => {
      if (prev.length > 1 && prev[prev.length - 1].overlay) {
        return prev.slice(0, prev.length - 1);
      }
      // If single item with overlay, clear overlay
      const top = prev[prev.length - 1];
      if (top && top.overlay) {
        return [{ view: top.view, overlay: null }];
      }
      return prev;
    });
  }, []);

  const resetToView = useCallback((view: ViewState) => {
    setHistoryStack([{ view, overlay: null }]);
  }, []);

  // Direct setters for 360 IDs to preserve backwards compatibility
  const setSelectedPropertyIdFor360 = useCallback(
    (id: string | null) => {
      if (id) {
        open360("property360", id);
      } else {
        closeCurrent360();
      }
    },
    [open360, closeCurrent360]
  );

  const setSelectedUnitIdFor360 = useCallback(
    (id: string | null) => {
      if (id) {
        open360("unit360", id);
      } else {
        closeCurrent360();
      }
    },
    [open360, closeCurrent360]
  );

  const setSelectedTenantIdFor360 = useCallback(
    (id: string | null) => {
      if (id) {
        open360("tenant360", id);
      } else {
        closeCurrent360();
      }
    },
    [open360, closeCurrent360]
  );

  const setSelectedOwnerIdFor360 = useCallback(
    (id: string | null) => {
      if (id) {
        open360("owner360", id);
      } else {
        closeCurrent360();
      }
    },
    [open360, closeCurrent360]
  );

  // Sync with browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (historyStack.length > 1) {
        setHistoryStack((prev) => (prev.length > 1 ? prev.slice(0, prev.length - 1) : prev));
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [historyStack.length]);

  return (
    <NavigationContext.Provider
      value={{
        currentNav,
        currentView,
        selectedPropertyIdFor360,
        selectedUnitIdFor360,
        selectedTenantIdFor360,
        selectedOwnerIdFor360,
        canGoBack,
        historyStack,
        navigateTo,
        open360,
        closeCurrent360,
        goBack,
        resetToView,
        setSelectedPropertyIdFor360,
        setSelectedUnitIdFor360,
        setSelectedTenantIdFor360,
        setSelectedOwnerIdFor360,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
};
