import { useCallback, useRef } from "react";

interface ResizeHandleProps {
  /** Callback with the new width (px) of the resized panel */
  onResize: (width: number) => void;
  direction?: "horizontal" | "vertical";
  /** Which sibling to resize: "left" reads previousElementSibling (default), "right" reads nextElementSibling and inverts delta */
  side?: "left" | "right";
}

export function ResizeHandle({
  onResize,
  direction = "horizontal",
  side = "left",
}: ResizeHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const handle = handleRef.current;
      if (!handle) return;

      const sibling = (
        side === "right" ? handle.nextElementSibling : handle.previousElementSibling
      ) as HTMLElement | null;
      if (!sibling) return;
      const startSize =
        direction === "horizontal"
          ? sibling.getBoundingClientRect().width
          : sibling.getBoundingClientRect().height;

      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        const delta = direction === "horizontal" ? ev.clientX - startX : ev.clientY - startY;
        const signedDelta = side === "right" ? -delta : delta;
        const newSize = Math.max(200, startSize + signedDelta);
        onResize(newSize);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [onResize, direction, side],
  );

  return (
    <div
      ref={handleRef}
      className={`resize-handle resize-handle--${direction}`}
      onMouseDown={onMouseDown}
    />
  );
}
