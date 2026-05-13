import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, useFontPreference } from "./useFontPreference";

describe("useFontPreference", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty("--app-font");
    document.documentElement.style.removeProperty("--app-font-size");
  });

  it("defaults to the full monospace font family", () => {
    const { result } = renderHook(() => useFontPreference());

    expect(result.current.fontFamily).toBe(DEFAULT_FONT_FAMILY);
    expect(document.documentElement.style.getPropertyValue("--app-font")).toBe(DEFAULT_FONT_FAMILY);
    expect(localStorage.getItem("codex-trace-font")).toBe(DEFAULT_FONT_FAMILY);
    expect(result.current.fontSize).toBe(DEFAULT_FONT_SIZE);
    expect(document.documentElement.style.getPropertyValue("--app-font-size")).toBe(
      `${DEFAULT_FONT_SIZE}px`,
    );
    expect(localStorage.getItem("codex-trace-font-size")).toBe(String(DEFAULT_FONT_SIZE));
  });

  it("loads a saved CSS font family string", () => {
    localStorage.setItem("codex-trace-font", '"IBM Plex Mono", monospace');

    const { result } = renderHook(() => useFontPreference());

    expect(result.current.fontFamily).toBe('"IBM Plex Mono", monospace');
    expect(document.documentElement.style.getPropertyValue("--app-font")).toBe(
      '"IBM Plex Mono", monospace',
    );
  });

  it("falls back to the default font family when the saved value is blank", () => {
    localStorage.setItem("codex-trace-font", "   ");

    const { result } = renderHook(() => useFontPreference());

    expect(result.current.fontFamily).toBe(DEFAULT_FONT_FAMILY);
    expect(document.documentElement.style.getPropertyValue("--app-font")).toBe(DEFAULT_FONT_FAMILY);
  });

  it("updates the document font and persists the CSS string", () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontFamily('"Maple Mono NF CN", "Microsoft YaHei", monospace');
    });

    expect(result.current.fontFamily).toBe('"Maple Mono NF CN", "Microsoft YaHei", monospace');
    expect(document.documentElement.style.getPropertyValue("--app-font")).toBe(
      '"Maple Mono NF CN", "Microsoft YaHei", monospace',
    );
    expect(localStorage.getItem("codex-trace-font")).toBe(
      '"Maple Mono NF CN", "Microsoft YaHei", monospace',
    );
  });

  it("loads a saved font size", () => {
    localStorage.setItem("codex-trace-font-size", "16");

    const { result } = renderHook(() => useFontPreference());

    expect(result.current.fontSize).toBe(16);
    expect(document.documentElement.style.getPropertyValue("--app-font-size")).toBe("16px");
  });

  it("updates and persists the font size", () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontSize(18);
    });

    expect(result.current.fontSize).toBe(18);
    expect(document.documentElement.style.getPropertyValue("--app-font-size")).toBe("18px");
    expect(localStorage.getItem("codex-trace-font-size")).toBe("18");
  });

  it("clamps invalid font sizes", () => {
    const { result } = renderHook(() => useFontPreference());

    act(() => {
      result.current.setFontSize(100);
    });

    expect(result.current.fontSize).toBe(24);
    expect(document.documentElement.style.getPropertyValue("--app-font-size")).toBe("24px");
  });
});
