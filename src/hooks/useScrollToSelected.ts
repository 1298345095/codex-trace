import { useRef, useEffect } from "react";

export function useScrollToSelected(dep: number) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let container = el.parentElement;
    while (container && container !== document.body) {
      const style = window.getComputedStyle(container);
      if (
        style.overflowY === "auto" ||
        style.overflowY === "scroll" ||
        style.overflow === "auto" ||
        style.overflow === "scroll"
      ) {
        break;
      }
      container = container.parentElement;
    }

    const containerHeight =
      container && container !== document.body ? container.clientHeight : window.innerHeight;

    const elRect = el.getBoundingClientRect();
    const containerRect =
      container && container !== document.body
        ? container.getBoundingClientRect()
        : new DOMRect(0, 0, window.innerWidth, window.innerHeight);

    if (elRect.top < containerRect.top || el.offsetHeight > containerHeight) {
      el.scrollIntoView({ block: "start" });
    } else if (elRect.bottom > containerRect.bottom) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [dep]);

  return ref;
}
