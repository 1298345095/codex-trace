import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "codex-trace-font";
const SIZE_STORAGE_KEY = "codex-trace-font-size";
export const DEFAULT_FONT_FAMILY =
  '"JetBrains Mono", "Sarasa Mono SC", "Maple Mono NF CN", "Noto Sans Mono CJK SC", "Microsoft YaHei UI", "Microsoft YaHei", ui-monospace, monospace';
export const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;

function normalizeFontFamily(value: string | null) {
  const trimmed = value?.trim();
  return trimmed || DEFAULT_FONT_FAMILY;
}

function applyFontFamily(nextFontFamily: string) {
  document.documentElement.style.setProperty("--app-font", normalizeFontFamily(nextFontFamily));
  localStorage.setItem(STORAGE_KEY, nextFontFamily.trim());
}

function normalizeFontSize(value: string | number | null) {
  if (value === null || value === "") {
    return DEFAULT_FONT_SIZE;
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_FONT_SIZE;
  }

  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(numericValue)));
}

function applyFontSize(nextFontSize: number) {
  const normalized = normalizeFontSize(nextFontSize);
  document.documentElement.style.setProperty("--app-font-size", `${normalized}px`);
  localStorage.setItem(SIZE_STORAGE_KEY, String(normalized));
}

export function useFontPreference() {
  const [fontFamily, setFontFamilyState] = useState(() =>
    normalizeFontFamily(localStorage.getItem(STORAGE_KEY)),
  );
  const [fontSize, setFontSizeState] = useState(() =>
    normalizeFontSize(localStorage.getItem(SIZE_STORAGE_KEY)),
  );

  const setFontFamily = useCallback((nextFontFamily: string) => {
    setFontFamilyState(nextFontFamily);
    applyFontFamily(nextFontFamily);
  }, []);

  const setFontSize = useCallback((nextFontSize: number) => {
    const normalized = normalizeFontSize(nextFontSize);
    setFontSizeState(normalized);
    applyFontSize(normalized);
  }, []);

  useEffect(() => {
    applyFontFamily(fontFamily);
    applyFontSize(fontSize);
  }, [fontFamily, fontSize]);

  return {
    fontFamily,
    fontSize,
    setFontFamily,
    setFontSize,
    defaultFontFamily: DEFAULT_FONT_FAMILY,
    defaultFontSize: DEFAULT_FONT_SIZE,
    minFontSize: MIN_FONT_SIZE,
    maxFontSize: MAX_FONT_SIZE,
  };
}
