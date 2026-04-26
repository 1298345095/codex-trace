import type { ViewState } from "../../shared/types";
import { IoMdSettings } from "react-icons/io";

interface ViewToolbarProps {
  view: ViewState;
  hasSession: boolean;
  onGoToSessions: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onOpenSettings: () => void;
}

function scrollContent(to: "top" | "bottom") {
  const el = document.querySelector(".main-content");
  if (el) el.scrollTo({ top: to === "top" ? 0 : el.scrollHeight, behavior: "smooth" });
}

export function ViewToolbar({
  view,
  hasSession,
  onGoToSessions,
  onExpandAll,
  onCollapseAll,
  onOpenSettings,
}: ViewToolbarProps) {
  return (
    <div className="view-toolbar">
      {view !== "picker" && hasSession && (
        <button className="view-toolbar__btn" onClick={onGoToSessions}>
          ← Sessions
        </button>
      )}
      <button className="view-toolbar__btn" onClick={onExpandAll}>
        Expand All
      </button>
      <button className="view-toolbar__btn" onClick={onCollapseAll}>
        Collapse All
      </button>
      <span className="view-toolbar__separator" />
      <button className="view-toolbar__btn" onClick={() => scrollContent("top")}>
        Top
      </button>
      <button className="view-toolbar__btn" onClick={() => scrollContent("bottom")}>
        Bottom
      </button>
      <span className="view-toolbar__spacer" />
      <button className="view-toolbar__btn" onClick={onOpenSettings} title="Settings (,)">
        <IoMdSettings />
      </button>
    </div>
  );
}
