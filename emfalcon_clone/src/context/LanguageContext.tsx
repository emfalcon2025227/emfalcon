import React, { createContext, useContext, useState, useEffect } from "react";
import { Language } from "../types";
import { translations } from "../translations";

interface LanguageContextType {
  language: Language;
  dir: "rtl" | "ltr";
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.ar) => string;
  formatAED: (amount: number | string | undefined | null) => string;
  formatDate: (dateStr: string | Date | undefined | null) => string;
  formatDateTime: (dateStr: string | Date | undefined | null) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("ef_lang");
    return (saved as Language) || "ar";
  });

  const dir: "rtl" | "ltr" = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    try {
      localStorage.setItem("ef_lang", language);
    } catch (e) {}
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === "ar" ? "en" : "ar"));
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: keyof typeof translations.ar): string => {
    const currentDict = translations[language] || translations.ar;
    return (currentDict[key] as string) || key;
  };

  const formatAED = (amount: number | string | undefined | null): string => {
    if (amount === undefined || amount === null || amount === "") return language === "ar" ? "0 د.إ" : "AED 0";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return language === "ar" ? "0 د.إ" : "AED 0";

    const formattedNum = new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);

    return language === "ar" ? `${formattedNum} د.إ` : `AED ${formattedNum}`;
  };

  const formatDate = (dateStr: string | Date | undefined | null): string => {
    if (!dateStr) return "-";
    try {
      const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return String(dateStr);
    }
  };

  const formatDateTime = (dateStr: string | Date | undefined | null): string => {
    if (!dateStr) return "-";
    try {
      const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${mins} (GST)`;
    } catch {
      return String(dateStr);
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        dir,
        toggleLanguage,
        setLanguage,
        t,
        formatAED,
        formatDate,
        formatDateTime,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
