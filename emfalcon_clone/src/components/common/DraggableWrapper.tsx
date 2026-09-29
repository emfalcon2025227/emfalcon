import React, { useState, useRef, useEffect } from "react";
import { motion, PanInfo } from "motion/react";
import { useLayout } from "../../context/LayoutContext";
import { useAuth } from "../../context/AuthContext";

interface DraggableWrapperProps {
  formId: string;
  elementId: string;
  children: React.ReactNode;
  className?: string;
}

export const DraggableWrapper: React.FC<DraggableWrapperProps> = ({
  formId,
  elementId,
  children,
  className = "",
}) => {
  const { layouts, updatePosition, loadLayout, saveLayout, isEditMode } = useLayout();
  const { currentUser } = useAuth();
  const [isLongPressed, setIsLongPressed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = currentUser?.role === "SYSTEM_OWNER" || currentUser?.role === "SUPER_ADMIN";
  const initialPos = layouts[formId]?.[elementId] || { x: 0, y: 0 };

  useEffect(() => {
    loadLayout(formId);
  }, [formId, loadLayout]);

  const handleStart = (e: React.PointerEvent) => {
    if (!isAdmin || !isEditMode) return;
    
    // Only trigger long press if it's a primary button click/touch
    if (e.button !== 0) return;

    timerRef.current = setTimeout(() => {
      setIsLongPressed(true);
      // Vibrate if mobile
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500); 
  };

  const handleEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onDragEnd = (_e: any, info: PanInfo) => {
    if (!isLongPressed) return;
    
    const snap = 5; // Finer snapping
    const x = Math.round(info.offset.x / snap) * snap + initialPos.x;
    const y = Math.round(info.offset.y / snap) * snap + initialPos.y;
    
    updatePosition(formId, elementId, { x, y });
    setIsLongPressed(false);
    
    // Auto-save the new position to Firestore
    saveLayout(formId);
  };

  return (
    <motion.div
      drag={isEditMode && isLongPressed}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      onPointerDown={handleStart}
      onPointerUp={handleEnd}
      onPointerLeave={handleEnd}
      animate={{ 
        x: initialPos.x, 
        y: initialPos.y,
        scale: isLongPressed ? 1.02 : 1,
        zIndex: isLongPressed ? 100 : 1,
        boxShadow: isLongPressed ? "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)" : "none"
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`${className} ${isLongPressed ? "ring-2 ring-amber-500/50 cursor-move relative bg-white/50 backdrop-blur-sm" : ""}`}
    >
      {children}
    </motion.div>
  );
};
