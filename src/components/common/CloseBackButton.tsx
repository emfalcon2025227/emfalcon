import React from "react";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigation } from "../../context/NavigationContext";

interface CloseBackButtonProps {
  onClose?: () => void;
  label?: string;
  variant?: "default" | "subtle" | "ghost" | "pill" | "dark";
  className?: string;
  showIcon?: boolean;
}

export const CloseBackButton: React.FC<CloseBackButtonProps> = ({
  onClose,
  label,
  variant = "default",
  className = "",
  showIcon = true,
}) => {
  const { language } = useLanguage();
  const { goBack, canGoBack } = useNavigation();

  const isAr = language === "ar";
  const displayLabel = label || (isAr ? "إغلاق" : "Close");

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClose) {
      onClose();
    } else {
      goBack();
    }
  };

  let variantClasses = "";
  switch (variant) {
    case "dark":
      variantClasses =
        "bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700";
      break;
    case "subtle":
      variantClasses =
        "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200";
      break;
    case "ghost":
      variantClasses =
        "bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent";
      break;
    case "pill":
      variantClasses =
        "bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-950 border border-slate-200 shadow-xs rounded-full";
      break;
    case "default":
    default:
      variantClasses =
        "bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs";
      break;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 shrink-0 select-none ${variantClasses} ${className}`}
      title={displayLabel}
    >
      {showIcon && <X className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-slate-700" />}
      <span>{displayLabel}</span>
    </button>
  );
};
