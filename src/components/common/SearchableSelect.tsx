import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";

export interface SearchableOption {
  id: string;
  value?: string;
  label?: string;
  title?: string;
  subLabel?: string;
  subtitle?: string;
  extraInfo?: string;
  badge?: string;
  badgeClassName?: string;
  extraSearchTerms?: string[];
  disabled?: boolean;
  data?: any;
}

export type SearchableSelectOption = SearchableOption;

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string, selectedOption?: SearchableOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options = [],
  value,
  onChange,
  placeholder = "-- اختر --",
  searchPlaceholder = "ابحث بالاسم أو الكود...",
  label,
  required = false,
  disabled = false,
  className = "",
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const getOptKey = (opt: SearchableOption) =>
    opt.id !== undefined && opt.id !== null ? String(opt.id) : opt.value !== undefined && opt.value !== null ? String(opt.value) : "";
  const getOptLabel = (opt: SearchableOption) => opt.label ?? opt.title ?? (opt.id ? String(opt.id) : "");
  const getOptSubLabel = (opt: SearchableOption) => opt.subLabel ?? opt.subtitle ?? opt.extraInfo ?? "";

  const getOptBadgeClass = (opt: SearchableOption) => {
    if (opt.badgeClassName) return opt.badgeClassName;
    const badgeText = opt.badge || "";
    if (badgeText.includes("🟢") || badgeText.includes("شاغرة") || badgeText.includes("خالية") || badgeText.toUpperCase().includes("VACANT")) {
      return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50";
    }
    if (badgeText.includes("🔴") || badgeText.includes("مؤجرة") || badgeText.toUpperCase().includes("OCCUPIED")) {
      return "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50";
    }
    if (badgeText.includes("🟡") || badgeText.includes("صيانة") || badgeText.toUpperCase().includes("MAINTENANCE")) {
      return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50";
    }
    return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
  };

  const selectedOption = options.find((opt) => getOptKey(opt) === String(value ?? ""));

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter options based on search term using Arabic normalization
  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const key = getOptKey(opt);
    const optLabel = getOptLabel(opt);
    const sub = getOptSubLabel(opt);
    const extra = opt.extraSearchTerms || [];
    return matchAnyArabicSearch([optLabel, sub, opt.badge, key, ...extra], searchTerm);
  });

  const handleSelect = (option: SearchableOption) => {
    onChange(getOptKey(option), option);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("", undefined);
    setSearchTerm("");
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Select Box Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-xs rounded-xl border text-right flex items-center justify-between gap-2 transition-all cursor-pointer ${
          disabled
            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed"
            : "bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 shadow-xs hover:shadow-md"
        } ${isOpen ? "ring-2 ring-amber-500/20 border-amber-600 bg-white dark:bg-slate-800 shadow-md" : ""}`}
      >
        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-slate-900 dark:text-white truncate">{getOptLabel(selectedOption)}</span>
              {getOptSubLabel(selectedOption) && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">({getOptSubLabel(selectedOption)})</span>
              )}
              {selectedOption.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${getOptBadgeClass(selectedOption)}`}>
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 font-medium">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedOption && getOptKey(selectedOption) !== "" && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
              title="إزالة الاختيار"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {error && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{error}</p>}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-[9999] left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Bar inside popover */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pr-8 pl-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500/20 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 dark:text-slate-500">
                لا توجد نتائج متطابقة للبحث
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const optKey = getOptKey(option);
                const isSelected = selectedOption && getOptKey(selectedOption) === optKey;
                const subLabelText = getOptSubLabel(option);
                const optLabel = getOptLabel(option);
                return (
                  <button
                    key={`${optKey}-${index}`}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => !option.disabled && handleSelect(option)}
                    className={`w-full text-right px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors ${
                      option.disabled
                        ? "opacity-50 cursor-not-allowed bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500"
                        : isSelected
                        ? "bg-amber-500/10 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold cursor-pointer"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                    }`}
                  >
                    <div className="flex flex-col truncate min-w-0">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{optLabel}</span>
                        {option.badge && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${getOptBadgeClass(option)}`}>
                            {option.badge}
                          </span>
                        )}
                      </div>
                      {subLabelText && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{subLabelText}</span>
                      )}
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
