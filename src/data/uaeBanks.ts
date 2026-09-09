export interface UaeBank {
  id: string;
  nameEn: string;
  nameAr: string;
  code: string;
  swift?: string;
}

export const UAE_BANKS: UaeBank[] = [
  { id: "enbd", nameEn: "Emirates NBD", nameAr: "بنك الإمارات دبي الوطني", code: "ENBD" },
  { id: "adcb", nameEn: "Abu Dhabi Commercial Bank (ADCB)", nameAr: "بنك أبوظبي التجاري", code: "ADCB" },
  { id: "fab", nameEn: "First Abu Dhabi Bank (FAB)", nameAr: "بنك أبوظبي الأول", code: "FAB" },
  { id: "dib", nameEn: "Dubai Islamic Bank (DIB)", nameAr: "بنك دبي الإسلامي", code: "DIB" },
  { id: "adib", nameEn: "Abu Dhabi Islamic Bank (ADIB)", nameAr: "مصرف أبوظبي الإسلامي", code: "ADIB" },
  { id: "mashreq", nameEn: "Mashreq Bank", nameAr: "بنك المشرق", code: "MASQ" },
  { id: "rakbank", nameEn: "RAKBANK (National Bank of Ras Al-Khaimah)", nameAr: "بنك رأس الخيمة الوطني", code: "RAK" },
  { id: "cbd", nameEn: "Commercial Bank of Dubai (CBD)", nameAr: "بنك دبي التجاري", code: "CBD" },
  { id: "sib", nameEn: "Sharjah Islamic Bank (SIB)", nameAr: "مصرف الشارقة الإسلامي", code: "SIB" },
  { id: "ajman", nameEn: "Ajman Bank", nameAr: "مصرف عجمان", code: "AJMAN" },
  { id: "eib", nameEn: "Emirates Islamic", nameAr: "الإمارات الإسلامي", code: "EIB" },
  { id: "nbq", nameEn: "National Bank of Umm Al-Qaiwain (NBQ)", nameAr: "بنك أم القيوين الوطني", code: "NBQ" },
  { id: "nbd", nameEn: "National Bank of Fujairah (NBF)", nameAr: "بنك الفجيرة الوطني", code: "NBF" },
  { id: "hsbc", nameEn: "HSBC Bank Middle East", nameAr: "بنك إتش إس بي سي", code: "HSBC" },
  { id: "scb", nameEn: "Standard Chartered Bank", nameAr: "ستاندرد تشارترد بنك", code: "SCB" },
  { id: "citi", nameEn: "Citibank UAE", nameAr: "سيتي بنك", code: "CITI" },
  { id: "alhilal", nameEn: "Al Hilal Bank", nameAr: "مصرف الهلال", code: "HILAL" },
  { id: "other", nameEn: "Other Bank", nameAr: "بنك آخر", code: "OTHER" },
];
