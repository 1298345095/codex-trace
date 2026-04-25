import type { CodexTurn } from "../../shared/types";
import { formatDuration, truncate } from "../../shared/format";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { useScrollToSelected } from "../hooks/useScrollToSelected";
import { OngoingDots } from "./OngoingDots";

interface TurnListProps {
  turns: CodexTurn[];
  selectedIndex: number;
  onSelectTurn: (index: number) => void;
}

function statusClass(status: CodexTurn["status"]): string {
  switch (status) {
    case "complete":
      return "turn-list__status--complete";
    case "aborted":
      return "turn-list__status--aborted";
    case "error":
      return "turn-list__status--error";
    case "ongoing":
      return "turn-list__status--ongoing";
  }
}

function statusLabel(status: CodexTurn["status"]): string {
  switch (status) {
    case "complete":
      return "✓";
    case "aborted":
      return "✗";
    case "error":
      return "!";
    case "ongoing":
      return "…";
  }
}

export function TurnList({ turns, selectedIndex, onSelectTurn }: TurnListProps) {
  const listRef = useAutoScroll<HTMLDivElement>(turns.length);
  const selectedRef = useScrollToSelected(selectedIndex);

  return (
    <div ref={listRef} className="turn-list">
      {turns.map((turn, i) => {
        const isSelected = i === selectedIndex;
        const preview = turn.user_message ? truncate(turn.user_message, 80) : "(no message)";

        return (
          <div
            key={turn.turn_id}
            ref={isSelected ? selectedRef : undefined}
            className={`turn-list__item${isSelected ? " turn-list__item--selected" : ""}`}
            onClick={() => onSelectTurn(i)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelectTurn(i);
            }}
          >
            <div className="turn-list__item-header">
              <span className="turn-list__num">{i + 1}</span>
              <span className={`turn-list__status ${statusClass(turn.status)}`}>
                {turn.status === "ongoing" ? <OngoingDots count={3} /> : statusLabel(turn.status)}
              </span>
              {turn.duration_ms !== null && (
                <span className="turn-list__duration">{formatDuration(turn.duration_ms)}</span>
              )}
              {turn.tool_calls.length > 0 && (
                <span className="turn-list__tools">{turn.tool_calls.length} tools</span>
              )}
              {turn.has_compaction && (
                <span className="turn-list__badge turn-list__badge--compact">compact</span>
              )}
              {turn.collab_spawns.length > 0 && (
                <span className="turn-list__badge turn-list__badge--collab">
                  +{turn.collab_spawns.length}
                </span>
              )}
            </div>
            <div className="turn-list__preview">{preview}</div>
          </div>
        );
      })}
      {turns.length === 0 && <div className="turn-list__empty">No turns in this session.</div>}
    </div>
  );
}
