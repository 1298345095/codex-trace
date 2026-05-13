import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ViewToolbar } from "./ViewToolbar";

function renderToolbar() {
  render(
    <ViewToolbar
      view="detail"
      hasSession={true}
      onGoToSessions={vi.fn()}
      onExpandAll={vi.fn()}
      onCollapseAll={vi.fn()}
      onOpenSettings={vi.fn()}
    />,
  );
}

describe("ViewToolbar", () => {
  it("scrolls the active detail body to the top", () => {
    document.body.innerHTML =
      '<div class="main-content"><div class="turn-detail__body"></div></div>';
    const target = document.querySelector<HTMLElement>(".turn-detail__body")!;
    Object.defineProperty(target, "scrollHeight", { configurable: true, value: 1000 });
    target.scrollTo = vi.fn();

    renderToolbar();
    fireEvent.click(screen.getByText("Top"));

    expect(target.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("scrolls the active list body to the bottom", () => {
    document.body.innerHTML = '<div class="main-content"><div class="message-list"></div></div>';
    const target = document.querySelector<HTMLElement>(".message-list")!;
    Object.defineProperty(target, "scrollHeight", { configurable: true, value: 1200 });
    target.scrollTo = vi.fn();

    renderToolbar();
    fireEvent.click(screen.getByText("Bottom"));

    expect(target.scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: "smooth" });
  });
});
