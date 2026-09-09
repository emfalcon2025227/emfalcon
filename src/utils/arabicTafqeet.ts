/**
 * EMIRATES FALCON ERP — TAFQEET UTILITY
 * Mathematical Arabic and English Currency Spell-out (Tafqeet) for UAE Dirhams & Fils
 */

const ARABIC_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const ARABIC_TEENS = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];
const ARABIC_TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const ARABIC_HUNDREDS = [
  "",
  "مائة",
  "مئتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

function convertArabicGroup(n: number): string {
  let res = "";
  const h = Math.floor(n / 100);
  const remainder = n % 100;
  const t = Math.floor(remainder / 10);
  const u = remainder % 10;

  if (h > 0) res += ARABIC_HUNDREDS[h];

  if (remainder > 0) {
    if (res.length > 0) res += " و ";
    if (remainder < 10) {
      res += ARABIC_ONES[remainder];
    } else if (remainder < 20) {
      res += ARABIC_TEENS[remainder - 10];
    } else {
      if (u > 0) res += ARABIC_ONES[u] + " و ";
      res += ARABIC_TENS[t];
    }
  }
  return res;
}

/**
 * Converts a numeric amount to formal Arabic words in UAE Dirhams and Fils.
 */
export function tafqeetAED(num: number): string {
  if (!num || isNaN(num) || num <= 0) return "صفر درهم إماراتي لا غير";

  const integerPart = Math.floor(Math.abs(num));
  const filsPart = Math.round((Math.abs(num) - integerPart) * 100);

  const billions = Math.floor(integerPart / 1000000000);
  const millions = Math.floor((integerPart % 1000000000) / 1000000);
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  const remainder = integerPart % 1000;

  const parts: string[] = [];

  if (billions > 0) {
    if (billions === 1) parts.push("مليار");
    else if (billions === 2) parts.push("ملياران");
    else if (billions >= 3 && billions <= 10) parts.push(convertArabicGroup(billions) + " مليارات");
    else parts.push(convertArabicGroup(billions) + " مليار");
  }

  if (millions > 0) {
    if (millions === 1) parts.push("مليون");
    else if (millions === 2) parts.push("مليونان");
    else if (millions >= 3 && millions <= 10) parts.push(convertArabicGroup(millions) + " ملايين");
    else parts.push(convertArabicGroup(millions) + " مليون");
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push("ألف");
    else if (thousands === 2) parts.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) parts.push(convertArabicGroup(thousands) + " آلاف");
    else parts.push(convertArabicGroup(thousands) + " ألف");
  }

  if (remainder > 0) {
    parts.push(convertArabicGroup(remainder));
  }

  let result = parts.length > 0 ? parts.join(" و ") + " درهم إماراتي" : "";

  if (filsPart > 0) {
    const filsWords = convertArabicGroup(filsPart);
    if (result.length > 0) {
      result += ` و ${filsWords} فلساً`;
    } else {
      result = `${filsWords} فلساً إماراتياً`;
    }
  }

  return (result || "صفر درهم") + " لا غير";
}

const ENGLISH_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const ENGLISH_TEENS = [
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const ENGLISH_TENS = ["", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function convertEnglishGroup(n: number): string {
  let res = "";
  const h = Math.floor(n / 100);
  const remainder = n % 100;
  const t = Math.floor(remainder / 10);
  const u = remainder % 10;

  if (h > 0) {
    res += ENGLISH_ONES[h] + " Hundred";
  }

  if (remainder > 0) {
    if (res.length > 0) res += " and ";
    if (remainder < 10) {
      res += ENGLISH_ONES[remainder];
    } else if (remainder < 20) {
      res += ENGLISH_TEENS[remainder - 10];
    } else {
      res += ENGLISH_TENS[t];
      if (u > 0) res += "-" + ENGLISH_ONES[u];
    }
  }
  return res;
}

/**
 * Converts a numeric amount to formal English words in UAE Dirhams and Fils.
 */
export function tafqeetEnglishAED(num: number): string {
  if (!num || isNaN(num) || num <= 0) return "Zero UAE Dirhams Only";

  const integerPart = Math.floor(Math.abs(num));
  const filsPart = Math.round((Math.abs(num) - integerPart) * 100);

  const billions = Math.floor(integerPart / 1000000000);
  const millions = Math.floor((integerPart % 1000000000) / 1000000);
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  const remainder = integerPart % 1000;

  const parts: string[] = [];

  if (billions > 0) parts.push(convertEnglishGroup(billions) + " Billion");
  if (millions > 0) parts.push(convertEnglishGroup(millions) + " Million");
  if (thousands > 0) parts.push(convertEnglishGroup(thousands) + " Thousand");
  if (remainder > 0) parts.push(convertEnglishGroup(remainder));

  let result = parts.length > 0 ? parts.join(", ") + " UAE Dirhams" : "";

  if (filsPart > 0) {
    const filsWords = convertEnglishGroup(filsPart);
    if (result.length > 0) {
      result += ` and ${filsWords} Fils`;
    } else {
      result = `${filsWords} Fils`;
    }
  }

  return (result || "Zero UAE Dirhams") + " Only";
}
