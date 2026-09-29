import React from "react";
import { normalizeArabicText } from "../../utils/arabicTextNormalizer";

export interface HighlightedTextProps {
  text: string | number | null | undefined;
  searchQuery?: string | number | null;
  className?: string;
  highlightClassName?: string;
}

/**
 * Utility component to highlight search terms within text.
 * Handles Arabic normalization (Alif variants, Ta Marbuta, diacritics, spaces)
 * and English/numeric case-insensitive substring matching.
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  searchQuery,
  className = "",
  highlightClassName = "",
}) => {
  if (text === null || text === undefined || text === "") {
    return null;
  }

  const strText = String(text);
  const rawQuery = searchQuery !== null && searchQuery !== undefined ? String(searchQuery).trim() : "";

  if (!rawQuery) {
    return className ? <span className={className}>{strText}</span> : <>{strText}</>;
  }

  const defaultHighlightClass =
    highlightClassName ||
    "bg-amber-200/90 text-amber-950 dark:bg-amber-500/35 dark:text-amber-200 font-bold px-0.5 rounded-xs transition-colors";

  const isMatched = new Array(strText.length).fill(false);

  // 1. Direct raw substring match (case-insensitive)
  const lowerText = strText.toLowerCase();
  const lowerQuery = rawQuery.toLowerCase();
  let pos = lowerText.indexOf(lowerQuery);
  while (pos !== -1 && lowerQuery.length > 0) {
    for (let i = pos; i < pos + lowerQuery.length; i++) {
      isMatched[i] = true;
    }
    pos = lowerText.indexOf(lowerQuery, pos + 1);
  }

  // 2. Tokenized search with Arabic normalization
  let normText = "";
  const normToOrig: number[] = [];

  for (let i = 0; i < strText.length; i++) {
    const char = strText[i];
    const normChar = normalizeArabicText(char, false);
    for (let j = 0; j < normChar.length; j++) {
      normText += normChar[j];
      normToOrig.push(i);
    }
  }

  const queryTokens = normalizeArabicText(rawQuery, false)
    .split(" ")
    .filter((t) => t.length > 0);

  for (const token of queryTokens) {
    if (!token) continue;
    let tPos = normText.indexOf(token);
    while (tPos !== -1) {
      const normStart = tPos;
      const normEnd = tPos + token.length - 1;
      if (normStart < normToOrig.length && normEnd < normToOrig.length) {
        const origStart = normToOrig[normStart];
        const origEnd = normToOrig[normEnd];
        for (let i = origStart; i <= origEnd; i++) {
          isMatched[i] = true;
        }
      }
      tPos = normText.indexOf(token, tPos + 1);
    }
  }

  // 3. Continuous space-agnostic Arabic search (e.g., query "عبدالله" vs text "عبد الله")
  let normTextNoSpaces = "";
  const normToOrigNoSpaces: number[] = [];

  for (let i = 0; i < strText.length; i++) {
    const char = strText[i];
    const normChar = normalizeArabicText(char, true);
    for (let j = 0; j < normChar.length; j++) {
      normTextNoSpaces += normChar[j];
      normToOrigNoSpaces.push(i);
    }
  }

  const normQueryNoSpaces = normalizeArabicText(rawQuery, true);
  if (normQueryNoSpaces && normQueryNoSpaces.length > 1) {
    let nsPos = normTextNoSpaces.indexOf(normQueryNoSpaces);
    while (nsPos !== -1) {
      const nsStart = nsPos;
      const nsEnd = nsPos + normQueryNoSpaces.length - 1;
      if (nsStart < normToOrigNoSpaces.length && nsEnd < normToOrigNoSpaces.length) {
        const origStart = normToOrigNoSpaces[nsStart];
        const origEnd = normToOrigNoSpaces[nsEnd];
        for (let i = origStart; i <= origEnd; i++) {
          isMatched[i] = true;
        }
      }
      nsPos = normTextNoSpaces.indexOf(normQueryNoSpaces, nsPos + 1);
    }
  }

  // Chunk original string by match state
  const chunks: { text: string; isMatch: boolean }[] = [];
  let currentText = "";
  let currentMatched = isMatched[0] || false;

  for (let i = 0; i < strText.length; i++) {
    if (isMatched[i] === currentMatched) {
      currentText += strText[i];
    } else {
      if (currentText) {
        chunks.push({ text: currentText, isMatch: currentMatched });
      }
      currentText = strText[i];
      currentMatched = isMatched[i];
    }
  }
  if (currentText) {
    chunks.push({ text: currentText, isMatch: currentMatched });
  }

  // If no parts were matched, return unhighlighted string
  if (chunks.length === 1 && !chunks[0].isMatch) {
    return className ? <span className={className}>{strText}</span> : <>{strText}</>;
  }

  return (
    <span className={className}>
      {chunks.map((chunk, idx) =>
        chunk.isMatch ? (
          <mark key={idx} className={defaultHighlightClass}>
            {chunk.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{chunk.text}</React.Fragment>
        )
      )}
    </span>
  );
};
