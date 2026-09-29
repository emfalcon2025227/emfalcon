import { UAE_BANKS, UaeBank } from "../data/uaeBanks";

const CUSTOM_BANKS_STORAGE_KEY = "emirates_falcon_custom_uae_banks_v1";

/**
 * Normalizes a bank name for exact duplicate comparison (trim, collapse spaces, lowercase, Arabic normalization)
 */
export function normalizeBankName(name: string): string {
  if (!name) return "";
  let clean = name.trim().toLowerCase();
  clean = clean.replace(/\s+/g, " ");
  // Arabic equivalences: normalize alef, yaa, taa marbouta
  clean = clean
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْ]/g, ""); // strip diacritics
  return clean;
}

/**
 * Checks if a bank with normalized name already exists in bank list
 */
export function isDuplicateBank(existingBanks: UaeBank[], newName: string): boolean {
  const normNew = normalizeBankName(newName);
  if (!normNew) return true;
  return existingBanks.some(
    (b) =>
      normalizeBankName(b.nameEn) === normNew ||
      normalizeBankName(b.nameAr) === normNew ||
      (b.code && normalizeBankName(b.code) === normNew)
  );
}

/**
 * Gets custom banks stored in localStorage
 */
export function getStoredCustomBanks(): UaeBank[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return [];
    }
    const raw = localStorage.getItem(CUSTOM_BANKS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse custom banks from localStorage:", e);
    return [];
  }
}


/**
 * Saves a new custom bank to localStorage
 */
export function saveCustomBank(bankName: string): UaeBank {
  const trimmed = bankName.trim();
  const customBanks = getStoredCustomBanks();
  const newBank: UaeBank = {
    id: `custom-bank-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
    nameEn: trimmed,
    nameAr: trimmed,
    code: trimmed.substring(0, 8).toUpperCase(),
  };

  const updated = [...customBanks, newBank];
  try {
    localStorage.setItem(CUSTOM_BANKS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save custom bank:", e);
  }

  return newBank;
}

/**
 * Returns all banks (standard UAE_BANKS + custom user added banks)
 */
export function getAllUaeBanks(): UaeBank[] {
  const custom = getStoredCustomBanks();
  // Filter out any custom bank that duplicates UAE_BANKS
  const uniqueCustom = custom.filter((cb) => !isDuplicateBank(UAE_BANKS, cb.nameAr));
  return [...UAE_BANKS, ...uniqueCustom];
}

export function getCanonicalBankId(name: string): string | null {
  if (!name) return null;
  const clean = normalizeBankName(name);
  if (!clean) return null;

  for (const b of UAE_BANKS) {
    if (b.id === "other") continue;
    const normEn = normalizeBankName(b.nameEn);
    const normAr = normalizeBankName(b.nameAr);
    const normCode = b.code ? normalizeBankName(b.code) : "";

    if (clean === normEn || clean === normAr || clean === normCode) {
      return b.id;
    }

    // Direct token / abbreviation matches
    if (clean === b.id) return b.id;

    // Specific bank aliases
    if (b.id === "adcb" && (clean.includes("adcb") || clean.includes("ابوظبي التجاري") || clean.includes("abu dhabi commercial"))) {
      return "adcb";
    }
    if (b.id === "fab" && (clean.includes("fab") || clean.includes("ابوظبي الاول") || clean.includes("first abu dhabi"))) {
      return "fab";
    }
    if (b.id === "enbd" && (clean.includes("enbd") || clean.includes("الامارات دبي الوطني") || clean.includes("emirates nbd"))) {
      return "enbd";
    }
    if (b.id === "dib" && (clean.includes("dib") || clean.includes("دبي الاسلامي") || clean.includes("dubai islamic"))) {
      return "dib";
    }
    if (b.id === "adib" && (clean.includes("adib") || clean.includes("ابوظبي الاسلامي") || clean.includes("abu dhabi islamic"))) {
      return "adib";
    }
    if (b.id === "cbd" && (clean.includes("cbd") || clean.includes("دبي التجاري") || clean.includes("commercial bank of dubai"))) {
      return "cbd";
    }
    if (b.id === "mashreq" && (clean.includes("mashreq") || clean.includes("المشرق"))) {
      return "mashreq";
    }
    if (b.id === "rakbank" && (clean.includes("rakbank") || clean.includes("راس الخيمه") || clean.includes("ras al khaimah"))) {
      return "rakbank";
    }
    if (b.id === "sib" && (clean.includes("sib") || clean.includes("الشارقه الاسلامي") || clean.includes("sharjah islamic"))) {
      return "sib";
    }
    if (b.id === "ajman" && (clean.includes("ajman") || clean.includes("عجمان"))) {
      return "ajman";
    }
    if (b.id === "eib" && (clean.includes("eib") || clean.includes("الامارات الاسلامي") || clean.includes("emirates islamic"))) {
      return "eib";
    }
    if (b.id === "nbq" && (clean.includes("nbq") || clean.includes("ام القيوين") || clean.includes("umm al qaiwain"))) {
      return "nbq";
    }
    if (b.id === "nbd" && (clean.includes("nbf") || clean.includes("الفجيره") || clean.includes("fujairah"))) {
      return "nbd";
    }
    if (b.id === "hsbc" && (clean.includes("hsbc") || clean.includes("اتش اس بي سي"))) {
      return "hsbc";
    }
    if (b.id === "scb" && (clean.includes("scb") || clean.includes("ستاندرد تشارترد") || clean.includes("standard chartered"))) {
      return "scb";
    }
    if (b.id === "citi" && (clean.includes("citi") || clean.includes("سيتي بنك"))) {
      return "citi";
    }
    if (b.id === "alhilal" && (clean.includes("hilal") || clean.includes("الهلال"))) {
      return "alhilal";
    }
  }

  return null;
}

/**
 * Deterministic bank matching: Compares two bank names using canonical bank IDs and normalized strings.
 */
export function matchBankNames(expectedBank: string, extractedBank: string): boolean {
  if (!expectedBank || !extractedBank) return false;
  const expClean = normalizeBankName(expectedBank);
  const extClean = normalizeBankName(extractedBank);
  if (expClean === extClean) return true;

  const expId = getCanonicalBankId(expectedBank);
  const extId = getCanonicalBankId(extractedBank);

  if (expId && extId) {
    return expId === extId;
  }

  return false;
}

