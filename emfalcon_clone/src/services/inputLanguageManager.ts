/**
 * Global Automatic Input Language Manager
 * 
 * Centralized service that detects input field language requirement (Arabic or English)
 * and configures browser/OS input behavior, lang attribute, direction (RTL/LTR),
 * and keyboard inputmode hints automatically on focus.
 * 
 * Respects existing values, database schemas, styling, layout, and API logic.
 */

export type InputLanguage = "ar" | "en";

export function initInputLanguageManager(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const handleFocus = (event: FocusEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Check if target is an editable input or textarea
    const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
    const isContentEditable = target.isContentEditable;

    if (!isInput && !isContentEditable) return;

    const inputEl = target as HTMLInputElement | HTMLTextAreaElement;

    // Detect intended language for this input field
    const targetLang = detectElementLanguage(inputEl);

    if (targetLang === "ar") {
      applyArabicInputSettings(inputEl);
    } else if (targetLang === "en") {
      applyEnglishInputSettings(inputEl);
    }
  };

  // Attach centralized focusin listener in capture phase
  // Ensures ALL current and dynamically rendered inputs (Forms, Modals, Tables, Search) are handled
  document.addEventListener("focusin", handleFocus, true);

  return () => {
    document.removeEventListener("focusin", handleFocus, true);
  };
}

/**
 * Detects whether an input field requires Arabic or English language input
 */
export function detectElementLanguage(el: HTMLElement): InputLanguage | null {
  // 1. Explicit data-lang, language, or lang attributes
  const explicitLang =
    el.getAttribute("data-lang") ||
    el.getAttribute("language") ||
    el.getAttribute("data-language") ||
    el.getAttribute("lang");

  if (explicitLang) {
    const normalized = explicitLang.toLowerCase().trim();
    if (normalized.startsWith("ar")) return "ar";
    if (normalized.startsWith("en")) return "en";
  }

  const inputEl = el as HTMLInputElement;
  const inputType = (inputEl.type || "").toLowerCase();
  const name = (inputEl.name || "").toLowerCase();
  const id = (inputEl.id || "").toLowerCase();
  const placeholder = (inputEl.placeholder || "").toLowerCase();
  const ariaLabel = (inputEl.getAttribute("aria-label") || "").toLowerCase();

  // 2. Technical types defaulting to English
  if (["email", "url", "password", "number", "tel"].includes(inputType)) {
    return "en";
  }

  // 3. Attribute naming conventions
  if (
    name.includes("en") ||
    name.includes("english") ||
    id.includes("en") ||
    id.includes("english") ||
    name.includes("email") ||
    id.includes("email") ||
    name.includes("phone") ||
    name.includes("iban") ||
    name.includes("swift") ||
    name.includes("code") ||
    name.includes("username") ||
    name.includes("password")
  ) {
    return "en";
  }

  if (
    name.includes("ar") ||
    name.includes("arabic") ||
    id.includes("ar") ||
    id.includes("arabic")
  ) {
    return "ar";
  }

  // 4. Associated label text analysis
  const labelText = findAssociatedLabelText(el).toLowerCase();

  if (
    labelText.includes("بالعربية") ||
    labelText.includes("بالعربي") ||
    labelText.includes("اسم بالعربي") ||
    labelText.includes("عربي")
  ) {
    return "ar";
  }

  if (
    labelText.includes("english") ||
    labelText.includes("in english") ||
    labelText.includes("email") ||
    labelText.includes("phone") ||
    labelText.includes("iban") ||
    labelText.includes("swift") ||
    labelText.includes("trn")
  ) {
    return "en";
  }

  // 5. Check placeholder or aria-label characters
  if (containsArabicChars(placeholder) || containsArabicChars(ariaLabel)) {
    return "ar";
  }

  if (containsArabicChars(labelText)) {
    return "ar";
  }

  return null;
}

function findAssociatedLabelText(el: HTMLElement): string {
  // Check for explicit label for="id"
  if (el.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.textContent) return label.textContent;
    } catch {
      // Ignore selector errors
    }
  }

  // Check parent label tag
  const parentLabel = el.closest("label");
  if (parentLabel && parentLabel.textContent) {
    return parentLabel.textContent;
  }

  // Check preceding sibling or container label
  const container = el.closest("div");
  if (container) {
    const prevLabel = container.querySelector("label");
    if (prevLabel && prevLabel.textContent) {
      return prevLabel.textContent;
    }
  }

  return "";
}

function containsArabicChars(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

function applyArabicInputSettings(el: HTMLElement) {
  el.setAttribute("lang", "ar");
  el.setAttribute("dir", "rtl");
  el.setAttribute("inputmode", "text");
  el.setAttribute("autocorrect", "on");
}

function applyEnglishInputSettings(el: HTMLElement) {
  el.setAttribute("lang", "en");
  el.setAttribute("dir", "ltr");
  const inputEl = el as HTMLInputElement;
  if (inputEl.type === "email") {
    el.setAttribute("inputmode", "email");
  } else if (inputEl.type === "number" || inputEl.type === "tel") {
    el.setAttribute("inputmode", "decimal");
  } else {
    el.setAttribute("inputmode", "text");
  }
}
