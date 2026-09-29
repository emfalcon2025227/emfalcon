/**
 * Central Arabic Text Normalization & Flexible Search Engine
 * 
 * Provides unified, space-agnostic, and diacritic-insensitive normalization
 * for Arabic & multilingual search across database queries, local filters, and AI assistant.
 */

// Comprehensive Arabic diacritics and formatting regex
const TASHKEEL_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08E1\u08E3-\u08FF]/g;
const TATWEEL_REGEX = /\u0640/g;
const ZERO_WIDTH_REGEX = /[\u200B-\u200F\uFEFF\u00AD]/g;
const ALL_WHITESPACE_REGEX = /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\t\r\n]+/g;
const MULTI_SPACE_REGEX = /[\s\u00A0\t\r\n]+/g;

/**
 * Normalize Arabic text for search and equality comparison.
 * 
 * @param input Text from database or user search query (accepts string, number, null, undefined)
 * @param removeAllSpaces If true, removes ALL spaces and non-word separators for ultra-flexible search (e.g. "عبد الله" === "عبدالله"). Defaults to true.
 * @returns Normalized string safe for comparison
 */
export function normalizeArabicText(
  input: string | number | null | undefined,
  removeAllSpaces: boolean = true
): string {
  if (input === null || input === undefined) {
    return "";
  }

  let text = String(input);
  if (!text) return "";

  // 1. Remove Zero-Width and hidden formatting characters
  text = text.replace(ZERO_WIDTH_REGEX, "");

  // 2. Remove all Tashkeel / Diacritics (Fatha, Damma, Kasra, Tanween, Shadda, Sukun...)
  text = text.replace(TASHKEEL_REGEX, "");

  // 3. Remove Tatweel / Kashida (ـ)
  text = text.replace(TATWEEL_REGEX, "");

  // 4. Normalize Alif & Hamza variants: أ, إ, آ, ٱ, ء -> ا
  text = text.replace(/[أإآٱ]/g, "ا");
  
  // Handle isolated / small Hamza (ء, ٴ)
  text = text.replace(/[ءٴ]/g, "");

  // 5. Normalize Waw with Hamza: ؤ -> و
  text = text.replace(/ؤ/g, "و");

  // 6. Normalize Ya variants: ى (Alif Maqsura), ئ (Ya with Hamza), ي -> ي
  text = text.replace(/[ىئ]/g, "ي");

  // 7. Normalize Ta Marbuta: ة -> ه (enables matching "بناية" with "بنايه" or "مؤسسة" with "مؤسسه")
  text = text.replace(/ة/g, "ه");

  // 8. Convert English/Latin letters to Lowercase for case-insensitive matching
  text = text.toLowerCase();

  // 9. Handle Spaces
  if (removeAllSpaces) {
    // Remove all whitespace characters, punctuation, hyphens, and slashes for seamless continuous matching
    text = text.replace(ALL_WHITESPACE_REGEX, "").replace(/[\-_/\\,.:;()'"[\]{}]/g, "");
  } else {
    // Collapse multiple spaces/tabs into a single standard space and trim edges
    text = text.replace(MULTI_SPACE_REGEX, " ").trim();
  }

  return text;
}

/**
 * Check whether a target string matches a search query using Arabic normalization and space-agnostic comparison.
 * 
 * Supports:
 * - Direct substring match with spaces removed ("عبد الله" matches "عبدالله" & "احمدمحمد" matches "أحمد محمد")
 * - Multi-token matching (if user types multiple separated words, all words must be found in target)
 * - Exact and partial matches with Arabic variants (أ/إ/آ -> ا, ة -> ه, ى -> ي, etc.)
 * 
 * @param target The database field / text to be searched
 * @param query The user's search input
 * @returns boolean true if match is found
 */
export function matchArabicSearch(
  target: string | number | null | undefined,
  query: string | number | null | undefined
): boolean {
  if (query === null || query === undefined) return true;
  
  const rawQuery = String(query).trim();
  if (!rawQuery) return true; // Empty search matches everything

  if (target === null || target === undefined) return false;

  const targetStr = String(target);
  if (!targetStr) return false;

  // 1. First test: continuous space-agnostic comparison
  const normTargetNoSpaces = normalizeArabicText(targetStr, true);
  const normQueryNoSpaces = normalizeArabicText(rawQuery, true);

  if (normQueryNoSpaces && normTargetNoSpaces.includes(normQueryNoSpaces)) {
    return true;
  }

  // 2. Second test: token-based matching (every search word must be found in target)
  const normTargetWithSpaces = normalizeArabicText(targetStr, false);
  const queryTokens = normalizeArabicText(rawQuery, false)
    .split(" ")
    .filter((tok) => tok.length > 0);

  if (queryTokens.length > 1) {
    const allTokensFound = queryTokens.every((token) =>
      normTargetWithSpaces.includes(token) || normTargetNoSpaces.includes(token)
    );
    if (allTokensFound) {
      return true;
    }
  }

  // 3. Fallback standard check (case-insensitive raw text)
  return targetStr.toLowerCase().includes(rawQuery.toLowerCase());
}

/**
 * Multi-field Arabic search matcher.
 * Returns true if ANY of the provided fields matches the query.
 * 
 * @param fields Array of target fields (e.g. [nameAr, nameEn, code, phone, email])
 * @param query The search query
 */
export function matchAnyArabicSearch(
  fields: Array<string | number | null | undefined>,
  query: string | number | null | undefined
): boolean {
  if (query === null || query === undefined || String(query).trim() === "") {
    return true;
  }
  return fields.some((field) => matchArabicSearch(field, query));
}
