import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, MapPin, Check, Plus, X, Sparkles } from "lucide-react";
import { ALL_AREAS, KHORFAKKAN_AREAS, AreaOption } from "../../data/propertyOptions";
import { useLanguage } from "../../context/LanguageContext";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";

interface AreaComboboxProps {
  value: string;
  onChange: (areaName: string, selectedAreaOption?: AreaOption) => void;
  emirate?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
}

export const AreaCombobox: React.FC<AreaComboboxProps> = ({
  value,
  onChange,
  emirate,
  label,
  required = false,
  disabled = false,
  className = "",
  error,
}) => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search input on dropdown open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter areas based on search term using Arabic normalization
  const filteredAreas = ALL_AREAS.filter((area) => {
    if (!searchTerm.trim()) {
      return true;
    }
    return matchAnyArabicSearch(
      [area.nameAr, area.nameEn, area.cityAr, area.cityEn, area.categoryAr, area.categoryEn],
      searchTerm
    );
  });

  // Group filtered areas for pleasant scanning
  const khorfakkanResults = filteredAreas.filter((a) => a.cityAr === "خورفكان");
  const otherResults = filteredAreas.filter((a) => a.cityAr !== "خورفكان");

  const handleSelectArea = (area: AreaOption) => {
    const areaName = language === "ar" ? area.nameAr : `${area.nameAr} (${area.nameEn})`;
    onChange(area.nameAr, area);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleCustomInput = (customValue: string) => {
    const trimmed = customValue.trim();
    if (!trimmed) return;
    onChange(trimmed, undefined);
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
        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-700" />
            <span>{label}</span>
            {required && <span className="text-rose-500">*</span>}
          </span>
          <span className="text-[10px] font-normal text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/50">
            {language === "ar" ? "مناطق خورفكان والإمارات" : "Khorfakkan & UAE Areas"}
          </span>
        </label>
      )}

      {/* Main Select Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-xs rounded-xl border text-right flex items-center justify-between gap-2 transition-all cursor-pointer ${
          disabled
            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
            : "bg-slate-50 hover:bg-white text-slate-800 border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
        } ${isOpen ? "ring-2 ring-amber-500/20 border-amber-600 bg-white" : ""}`}
      >
        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          {value ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-slate-900 truncate">{value}</span>
              {KHORFAKKAN_AREAS.some((a) => a.nameAr === value || a.nameEn === value) && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 shrink-0">
                  {language === "ar" ? "خورفكان" : "Khorfakkan"}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-medium">
              {language === "ar" ? "-- اختر المنطقة أو ابحث (حي اللؤلؤية، الزبارة...) --" : "-- Select or search area (Al Luluyah, Al Zubarah...) --"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
              title={language === "ar" ? "مسح" : "Clear"}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-80 flex flex-col">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/90 shrink-0 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredAreas.length > 0) {
                      handleSelectArea(filteredAreas[0]);
                    } else if (searchTerm.trim()) {
                      handleCustomInput(searchTerm);
                    }
                  }
                }}
                placeholder={
                  language === "ar"
                    ? "ابحث في مناطق خورفكان (اللؤلؤية، الزبارة، الحراي، المديفي...)"
                    : "Search Khorfakkan areas (Al Luluyah, Al Zubarah...)"
                }
                className="w-full ps-9 pe-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500/20 text-slate-800"
              />
            </div>

            {/* Quick Chips for Top Khorfakkan Districts */}
            {!searchTerm && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                <span className="text-slate-400 text-[10px] shrink-0 font-medium">
                  {language === "ar" ? "سريع:" : "Quick:"}
                </span>
                {["حي اللؤلؤية", "الزبارة", "اليرموك", "المديفي", "الحراي السكنية", "القادسية"].map((quickName) => (
                  <button
                    key={quickName}
                    type="button"
                    onClick={() => {
                      const matched = KHORFAKKAN_AREAS.find((a) => a.nameAr === quickName);
                      if (matched) handleSelectArea(matched);
                      else handleCustomInput(quickName);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-amber-900 hover:bg-amber-100 hover:border-amber-300 font-bold shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    {quickName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Areas List with Groups */}
          <div className="overflow-y-auto p-1.5 space-y-2 flex-1">
            {/* Custom Input prompt if user typed something not matched or custom */}
            {searchTerm.trim() && (
              <button
                type="button"
                onClick={() => handleCustomInput(searchTerm)}
                className="w-full text-right px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 bg-amber-50/80 border border-amber-200 text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer font-bold"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-amber-700" />
                  <span>
                    {language === "ar" ? "استخدام كمنطقة مخصصة:" : "Use as custom area:"}{" "}
                    <strong className="text-amber-950 underline">{searchTerm.trim()}</strong>
                  </span>
                </div>
                <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded-md font-mono">
                  Enter ↵
                </span>
              </button>
            )}

            {/* Khorfakkan Section */}
            {khorfakkanResults.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider text-emerald-800 bg-emerald-50/80 rounded-lg flex items-center justify-between mb-1 border border-emerald-200/60">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>{language === "ar" ? "أحياء ومناطق مدينة خورفكان" : "Khorfakkan City Districts"}</span>
                  </span>
                  <span className="font-mono text-emerald-700">({khorfakkanResults.length})</span>
                </div>
                <div className="space-y-0.5">
                  {khorfakkanResults.map((area) => {
                    const isSelected = value === area.nameAr || value === area.nameEn;
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => handleSelectArea(area)}
                        className={`w-full text-right px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/10 text-amber-900 font-bold border border-amber-200"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <div className="flex flex-col truncate min-w-0">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-slate-900 truncate">
                              {language === "ar" ? area.nameAr : area.nameEn}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate">
                              ({language === "ar" ? area.nameEn : area.nameAr})
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-700 font-medium mt-0.5">
                            {language === "ar" ? area.categoryAr : area.categoryEn}
                          </span>
                        </div>

                        {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Other UAE Regions */}
            {otherResults.length > 0 && (
              <div className="pt-1">
                <div className="px-2.5 py-1 text-[10px] font-black tracking-wider text-slate-600 bg-slate-100 rounded-lg flex items-center justify-between mb-1">
                  <span>{language === "ar" ? "مناطق أخرى في الشارقة والإمارات" : "Other Sharjah & UAE Areas"}</span>
                  <span className="font-mono text-slate-500">({otherResults.length})</span>
                </div>
                <div className="space-y-0.5">
                  {otherResults.map((area) => {
                    const isSelected = value === area.nameAr || value === area.nameEn;
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => handleSelectArea(area)}
                        className={`w-full text-right px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/10 text-amber-900 font-bold border border-amber-200"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <div className="flex flex-col truncate min-w-0">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-slate-800 truncate">
                              {language === "ar" ? area.nameAr : area.nameEn}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate">
                              ({language === "ar" ? area.nameEn : area.nameAr})
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            {area.cityAr} — {language === "ar" ? area.categoryAr : area.categoryEn}
                          </span>
                        </div>

                        {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredAreas.length === 0 && !searchTerm.trim() && (
              <div className="p-4 text-center text-xs text-slate-400">
                {language === "ar" ? "لا توجد مناطق متاحة" : "No areas available"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
