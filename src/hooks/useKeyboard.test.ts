import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKeyboard } from "./useKeyboard";

describe("useKeyboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the mapped handler when the key is pressed", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ Escape: handler }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not call handler for unmapped keys", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ Escape: handler }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call handler when target is an input element", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ Escape: handler }));
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    document.body.removeChild(input);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call handler when target is a textarea", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ Escape: handler }));
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    document.body.removeChild(ta);
    expect(handler).not.toHaveBeenCalled();
  });

  it("removes the event listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboard({ Escape: handler }));
    unmount();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls the latest handler even after the keyMap changes", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useKeyboard({ Escape: fn }), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });
});
