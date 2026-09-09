import { Language } from "../types";

const COMMON_AR_TO_EN: { [key: string]: string } = {
  "محمد": "Mohamed",
  "احمد": "Ahmed",
  "أحمد": "Ahmed",
  "علي": "Ali",
  "حسن": "Hassan",
  "حسين": "Hussein",
  "محمود": "Mahmoud",
  "مصطفى": "Mustafa",
  "ابراهيم": "Ibrahim",
  "إبراهيم": "Ibrahim",
  "خالد": "Khaled",
  "عمر": "Omar",
  "عثمان": "Othman",
  "يوسف": "Yousef",
  "سعيد": "Said",
  "سعد": "Saad",
  "سليمان": "Sulaiman",
  "عبد": "Abdul",
  "عبدالرحمن": "Abdulrahman",
  "عبد الرحمن": "Abdulrahman",
  "عبدالله": "Abdullah",
  "عبد الله": "Abdullah",
  "فهد": "Fahad",
  "صالح": "Saleh",
  "فيصل": "Faisal",
  "سلطان": "Sultan",
  "ماجد": "Majed",
  "تركي": "Turki",
  "نايف": "Nayef",
  "بندر": "Bandar",
  "سعدون": "Saadoon",
  "جاسم": "Jasim",
  "حامد": "Hamid",
  "حميد": "Hamid",
  "سالم": "Salem",
  "سليم": "Salim",
  "أمل": "Amal",
  "فاطمة": "Fatima",
  "مريم": "Maryam",
  "عائشة": "Aisha",
  "سارة": "Sara",
  "نورة": "Noura",
  "هيا": "Haya",
  "منى": "Mona",
  "ليلى": "Layla",
  "زينب": "Zainab",
  "هند": "Hind",
  "ريم": "Reem",
  "نور": "Nour",
  "هدى": "Hoda",
  "رئيس": "President",
  "برج": "Tower",
  "بناية": "Building",
  "شقة": "Apartment",
  "فيلا": "Villa",
  "مكتب": "Office",
  "محل": "Shop",
  "مستودع": "Warehouse",
  "معرض": "Showroom",
  "عقار": "Property",
  "صقر": "Falcon",
  "الإمارات": "Emirates",
  "الامارات": "Emirates",
  "دبي": "Dubai",
  "الشارقة": "Sharjah",
  "عجمان": "Ajman",
  "خورفكان": "Khorfakkan",
  "أبوظبي": "Abu Dhabi",
  "ابوظبي": "Abu Dhabi",
  "رأس الخيمة": "Ras Al Khaimah",
  "راس الخيمة": "Ras Al Khaimah",
  "الفجيرة": "Fujairah",
  "أم القيوين": "Umm Al Quwain",
  "ام القيوين": "Umm Al Quwain",
  "المنطقة": "Zone",
  "المنطقة الصناعية": "Industrial Area",
  "صناعية": "Industrial",
  "السكنية": "Residential",
  "سكنية": "Residential",
  "استثمار": "Investment",
  "الاستثمار": "Investment",
  "الاستثمارات": "Investments",
  "استثمارات": "Investments",
  "عقاري": "Real Estate",
  "العقارية": "Real Estate",
  "العقارات": "Real Estate",
  "عقارات": "Real Estate",
  "شركة": "Company",
  "مؤسسة": "Establishment",
  "مجموعة": "Group",
  "شركاء": "Partners",
  "وشركاه": "and Partners",
  "القابضة": "Holding",
  "العامة": "General",
  "التجارة": "Trading",
  "تجارة": "Trading",
  "المقاولات": "Contracting",
  "مقاولات": "Contracting",
  "الخدمات": "Services",
  "خدمات": "Services",
  "الفاخرة": "Luxury",
  "الحديثة": "Modern",
  "الوطنية": "National",
  "الدولية": "International",
  "الخليج": "Gulf",
  "العربية": "Arabian",
  "بن": "Bin",
  "ال": "Al-",
};

// Simple inverted mapping for reverse suggestions
const COMMON_EN_TO_AR: { [key: string]: string } = {};
Object.entries(COMMON_AR_TO_EN).forEach(([ar, en]) => {
  const cleanEn = en.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!COMMON_EN_TO_AR[cleanEn]) {
    COMMON_EN_TO_AR[cleanEn] = ar;
  }
});

// Let's add additional English words directly
COMMON_EN_TO_AR["properties"] = "عقارات";
COMMON_EN_TO_AR["property"] = "عقار";
COMMON_EN_TO_AR["tower"] = "برج";
COMMON_EN_TO_AR["building"] = "بناية";
COMMON_EN_TO_AR["llc"] = "ذ.م.م";
COMMON_EN_TO_AR["realestate"] = "العقارية";
COMMON_EN_TO_AR["real"] = "حقيقي";
COMMON_EN_TO_AR["estate"] = "عقار";
COMMON_EN_TO_AR["investment"] = "استثمار";
COMMON_EN_TO_AR["investments"] = "استثمارات";
COMMON_EN_TO_AR["group"] = "مجموعة";
COMMON_EN_TO_AR["services"] = "خدمات";
COMMON_EN_TO_AR["company"] = "شركة";
COMMON_EN_TO_AR["contracting"] = "المقاولات";
COMMON_EN_TO_AR["trading"] = "التجارة";
COMMON_EN_TO_AR["general"] = "العامة";
COMMON_EN_TO_AR["holding"] = "القابضة";
COMMON_EN_TO_AR["national"] = "الوطنية";
COMMON_EN_TO_AR["international"] = "الدولية";
COMMON_EN_TO_AR["andpartners"] = "وشركاه";

/**
 * Normalizes and localizes Arabic text or transliterates it.
 */
export function localTransliterateArToEn(arText: string): string {
  if (!arText) return "";
  const parts = arText.trim().split(/\s+/);
  const translatedParts = parts.map((part) => {
    // Exact match
    if (COMMON_AR_TO_EN[part]) return COMMON_AR_TO_EN[part];
    
    // Normalize Alef, Hamza
    const normalizedPart = part
      .replace(/^[إأآا]/, "أ")
      .replace(/ة$/, "ه");
    if (COMMON_AR_TO_EN[normalizedPart]) return COMMON_AR_TO_EN[normalizedPart];
    
    // Fallback simple phonetic rules
    return part
      .replace(/أ/g, "A")
      .replace(/ا/g, "a")
      .replace(/ب/g, "b")
      .replace(/ت/g, "t")
      .replace(/ث/g, "th")
      .replace(/ج/g, "j")
      .replace(/ح/g, "h")
      .replace(/خ/g, "kh")
      .replace(/د/g, "d")
      .replace(/ذ/g, "dh")
      .replace(/ر/g, "r")
      .replace(/ز/g, "z")
      .replace(/س/g, "s")
      .replace(/ش/g, "sh")
      .replace(/ص/g, "s")
      .replace(/ض/g, "d")
      .replace(/ط/g, "t")
      .replace(/ظ/g, "z")
      .replace(/ع/g, "a")
      .replace(/غ/g, "gh")
      .replace(/ف/g, "f")
      .replace(/ق/g, "q")
      .replace(/ك/g, "k")
      .replace(/ل/g, "l")
      .replace(/م/g, "m")
      .replace(/ن/g, "n")
      .replace(/ه/g, "h")
      .replace(/و/g, "w")
      .replace(/ي/g, "y")
      .replace(/ئ/g, "i")
      .replace(/ء/g, "'")
      .replace(/ى/g, "a");
  });

  return translatedParts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
    .replace(/\s+Al-/g, " Al-")
    .trim();
}

export function localTransliterateEnToAr(enText: string): string {
  if (!enText) return "";
  const parts = enText.trim().split(/\s+/);
  const translatedParts = parts.map((part) => {
    const cleanPart = part.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (COMMON_EN_TO_AR[cleanPart]) return COMMON_EN_TO_AR[cleanPart];

    // Fallback phonetic rules English -> Arabic
    let ar = part.toLowerCase()
      .replace(/sch/g, "ش")
      .replace(/sh/g, "ش")
      .replace(/kh/g, "خ")
      .replace(/th/g, "ث")
      .replace(/ph/g, "ف")
      .replace(/gh/g, "غ")
      .replace(/ch/g, "ش")
      .replace(/ee/g, "ي")
      .replace(/oo/g, "و")
      .replace(/ou/g, "و")
      .replace(/aa/g, "ا")
      .replace(/a/g, "ا")
      .replace(/b/g, "ب")
      .replace(/c/g, "ك")
      .replace(/d/g, "د")
      .replace(/e/g, "ي")
      .replace(/f/g, "ف")
      .replace(/g/g, "ج")
      .replace(/h/g, "ه")
      .replace(/i/g, "ي")
      .replace(/j/g, "ج")
      .replace(/k/g, "ك")
      .replace(/l/g, "ل")
      .replace(/m/g, "م")
      .replace(/n/g, "ن")
      .replace(/o/g, "و")
      .replace(/p/g, "ب")
      .replace(/q/g, "ق")
      .replace(/r/g, "ر")
      .replace(/s/g, "س")
      .replace(/t/g, "ت")
      .replace(/u/g, "و")
      .replace(/v/g, "ف")
      .replace(/w/g, "و")
      .replace(/x/g, "كس")
      .replace(/y/g, "ي")
      .replace(/z/g, "ز");
    return ar;
  });

  return translatedParts.join(" ").trim();
}

/**
 * Returns an instant local offline suggestion (zero latency).
 */
export function getLocalBilingualSuggestion(
  name: string,
  fromLang: "ar" | "en"
): string {
  if (!name || !name.trim()) return "";
  if (fromLang === "ar") {
    return localTransliterateArToEn(name);
  } else {
    return localTransliterateEnToAr(name);
  }
}

/**
 * Returns a bilingual/transliterated name suggestion.
 * If useAI is false, returns local suggestion instantly.
 * If useAI is true, attempts to call the server API (Gemini model) first, falls back to local rules.
 */
export async function getBilingualSuggestion(
  name: string,
  fromLang: "ar" | "en",
  useAI = true
): Promise<string> {
  if (!name || !name.trim()) return "";
  
  if (!useAI) {
    return getLocalBilingualSuggestion(name, fromLang);
  }

  try {
    const response = await fetch("/api/ai/transliterate-name", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        from: fromLang,
        to: fromLang === "ar" ? "en" : "ar",
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.suggestion) {
        return data.suggestion;
      }
    }
  } catch (err) {
    console.warn("Server transliteration failed, using local fallback rules:", err);
  }

  // Fallback to local offline rules
  return getLocalBilingualSuggestion(name, fromLang);
}

/**
 * Reusable unified localized name resolver for any entity.
 */
export function getLocalizedEntityName(
  entity: any,
  lang: Language,
  fallbackField?: string
): string {
  if (!entity) return "";
  
  const isAr = lang === "ar";
  
  if (isAr) {
    if (entity.nameAr && entity.nameAr.trim()) return entity.nameAr;
    if (entity.nameEn && entity.nameEn.trim()) return entity.nameEn;
  } else {
    if (entity.nameEn && entity.nameEn.trim()) return entity.nameEn;
    if (entity.nameAr && entity.nameAr.trim()) return entity.nameAr;
  }
  
  // Logical Fallbacks
  if (entity.code) return entity.code;
  if (fallbackField && entity[fallbackField]) return String(entity[fallbackField]);
  if (entity.id) return String(entity.id);
  
  return "";
}
