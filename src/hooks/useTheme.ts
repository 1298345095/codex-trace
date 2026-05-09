import { useCallback, useEffect, useState } from "react";
import { setTheme as setTauriTheme } from "@tauri-apps/api/app";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "codex-trace-theme";

function getSystemTheme(): ResolvedTheme {
  if (!globalThis.matchMedia) {
    return "dark";
  }

  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }

    return "system";
  });

  const applyTheme = useCallback((nextMode: ThemeMode) => {
    const resolvedTheme = resolveTheme(nextMode);

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;

    localStorage.setItem(STORAGE_KEY, nextMode);

    setTauriTheme(nextMode === "system" ? null : nextMode).catch(() => {
      // Web 模式或测试环境中 Tauri API 可能不可用，忽略即可
    });
  }, []);

  const setThemeMode = useCallback(
    (nextMode: ThemeMode) => {
      setMode(nextMode);
      applyTheme(nextMode);
    },
    [applyTheme],
  );

  useEffect(() => {
    applyTheme(mode);

    if (!globalThis.matchMedia) {
      return;
    }

    const media = globalThis.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (mode === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, [mode, applyTheme]);

  return {
    themeMode: mode,
    setThemeMode,
    resolvedTheme: resolveTheme(mode),
  };
}