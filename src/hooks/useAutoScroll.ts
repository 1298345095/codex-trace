import { useRef, useEffect, useLayoutEffect, type RefObject } from "react";

/**
 * Auto-scrolls a container to the bottom when content changes,
 * but only if the user was already near the bottom before the update.
 */
export function useAutoScroll<T extends HTMLElement>(
  itemCount: number,
  existingRef?: RefObject<T | null>,
  threshold = 150,
) {
  const ownRef = useRef<T>(null);
  const ref = existingRef ?? ownRef;
  const prevCountRef = useRef(itemCount);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const checkNearBottom = () => {
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };

    checkNearBottom();
    el.addEventListener("scroll", checkNearBottom, { passive: true });
    return () => el.removeEventListener("scroll", checkNearBottom);
  }, [ref, threshold]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && itemCount > prevCountRef.current && isNearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    prevCountRef.current = itemCount;
  }, [itemCount, ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList" && isNearBottomRef.current) {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          break;
        }
      }
    });

    observer.observe(el, { childList: true });
    return () => observer.disconnect();
  }, [ref]);

  return ref;
}
