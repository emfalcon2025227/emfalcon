import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
    label?: string;
  };
  accentColor?: "emerald" | "amber" | "rose" | "sky" | "indigo" | "slate";
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  accentColor = "indigo",
  onClick,
}) => {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    sky: "bg-sky-50 text-sky-600 border-sky-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-2xl p-5 border border-slate-200/80 w-full h-full flex flex-col justify-between transition-all ${
        onClick ? "cursor-pointer hover:border-slate-300 shadow-xs" : "shadow-xs"
      }`}
    >
      <div className="flex items-start justify-between gap-4 w-full">
        <div className="space-y-1.5 flex-1 min-w-0 text-start">
          <p className="text-xs font-semibold text-slate-500 truncate">{title}</p>
          <h4 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{value}</h4>
          {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
        </div>

        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${colorMap[accentColor]}`}
        >
          {icon}
        </div>
      </div>

      {trend && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs">
          <span
            className={`inline-flex items-center font-bold ${
              trend.isPositive ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {trend.isPositive ? (
              <TrendingUp className="w-3.5 h-3.5 me-1" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 me-1" />
            )}
            {trend.value}
          </span>
          {trend.label && <span className="text-slate-400 font-normal">{trend.label}</span>}
        </div>
      )}
    </div>
  );
};
