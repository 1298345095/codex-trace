import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useToggleSet } from "./useToggleSet";

describe("useToggleSet", () => {
  it("starts with an empty set", () => {
    const { result } = renderHook(() => useToggleSet());
    expect(result.current.set.size).toBe(0);
  });

  it("adds an index on first toggle", () => {
    const { result } = renderHook(() => useToggleSet());
    act(() => result.current.toggle(3));
    expect(result.current.set.has(3)).toBe(true);
  });

  it("removes an index on second toggle (toggle off)", () => {
    const { result } = renderHook(() => useToggleSet());
    act(() => result.current.toggle(3));
    act(() => result.current.toggle(3));
    expect(result.current.set.has(3)).toBe(false);
  });

  it("handles multiple independent indices", () => {
    const { result } = renderHook(() => useToggleSet());
    act(() => result.current.toggle(1));
    act(() => result.current.toggle(5));
    expect(result.current.set.has(1)).toBe(true);
    expect(result.current.set.has(5)).toBe(true);
    expect(result.current.set.size).toBe(2);
  });

  it("clear removes all indices", () => {
    const { result } = renderHook(() => useToggleSet());
    act(() => result.current.toggle(1));
    act(() => result.current.toggle(2));
    act(() => result.current.clear());
    expect(result.current.set.size).toBe(0);
  });

  it("addAll adds multiple indices at once", () => {
    const { result } = renderHook(() => useToggleSet());
    act(() => result.current.addAll([1, 2, 3]));
    expect(result.current.set.has(1)).toBe(true);
    expect(result.current.set.has(2)).toBe(true);
    expect(result.current.set.has(3)).toBe(true);
  });

  it("addAll merges with existing indices", () => {
    const { result } = renderHook(() => useToggleSet());
    act(() => result.current.toggle(0));
    act(() => result.current.addAll([1, 2]));
    expect(result.current.set.has(0)).toBe(true);
    expect(result.current.set.has(1)).toBe(true);
  });
});
