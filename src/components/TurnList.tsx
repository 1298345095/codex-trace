import { useState, useCallback } from "react";
import type { CodexTurn } from "../../shared/types";
import { formatDuration, formatTokens, truncate } from "../../shared/format";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { useScrollToSelected } from "../hooks/useScrollToSelected";
import { OngoingDots } from "./OngoingDots";
import {
  UserIcon,
  CodexIcon,
  ForwardIcon,
  TokensIcon,
  ToolsIcon,
  DurationIcon,
  ThinkingIcon,
} from "./Icons";

interface TurnListProps {
  turns: CodexTurn[];
  selectedIndex: number;
  onSelectTurn: (index: number) => void;
}

export function TurnList({ turns, selectedIndex, onSelectTurn }: TurnListProps) {
  const listRef = useAutoScroll<HTMLDivElement>(turns.length);
  const selectedRef = useScrollToSelected(selectedIndex);
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());

  const toggleUser = useCallback((i: number) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  return (
    <div ref={listRef} className="turn-list">
      {turns.map((turn, i) => {
        const isSelected = i === selectedIndex;
        const userMsg = turn.user_message ?? "(no message)";
        const userExpanded = expandedUsers.has(i);
        const agentPreview =
          turn.agent_messages.find((m) => m.phase === "final_answer")?.text ??
          turn.agent_messages.find((m) => !m.is_reasoning)?.text ??
          null;
        const hasDetail = turn.agent_messages.length > 0 || turn.tool_calls.length > 0;

        return (
          <div
            key={turn.turn_id}
            ref={isSelected ? selectedRef : undefined}
            className={`turn-list__turn${isSelected ? " turn-list__turn--selected" : ""}`}
          >
            {/* User row */}
            <div
              className="turn-list__row turn-list__row--user"
              onClick={() => toggleUser(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") toggleUser(i);
              }}
            >
              <span className="turn-list__row-icon">
                <UserIcon />
              </span>
              <span className="turn-list__row-role turn-list__row-role--user">User</span>
              {!userExpanded && (
                <span className="turn-list__row-preview">{truncate(userMsg, 120)}</span>
              )}
            </div>
            {userExpanded && <div className="turn-list__row-expanded">{userMsg}</div>}

            {/* Agent row */}
            <div
              className="turn-list__row turn-list__row--agent"
              onClick={() => onSelectTurn(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelectTurn(i);
              }}
            >
              <span className="turn-list__row-icon">
                <CodexIcon />
              </span>
              <span className="turn-list__row-role turn-list__row-role--agent">Codex</span>
              {turn.status === "ongoing" ? (
                <OngoingDots count={3} />
              ) : (
                <span className={`turn-list__row-status turn-list__row-status--${turn.status}`}>
                  {turn.status === "complete" ? "✓" : turn.status === "aborted" ? "✗" : "!"}
                </span>
              )}
              {(turn.total_tokens?.total_tokens ?? 0) > 0 && (
                <span className="turn-list__stat">
                  <TokensIcon />
                  {formatTokens(turn.total_tokens!.total_tokens)}
                </span>
              )}
              {turn.tool_calls.length > 0 && (
                <span className="turn-list__stat">
                  <ToolsIcon />
                  {turn.tool_calls.length}
                </span>
              )}
              {turn.agent_messages.some((m) => m.is_reasoning) && (
                <span className="turn-list__stat">
                  <ThinkingIcon />
                  {turn.agent_messages.filter((m) => m.is_reasoning).length}
                </span>
              )}
              {turn.duration_ms !== null && (
                <span className="turn-list__stat">
                  <DurationIcon />
                  {formatDuration(turn.duration_ms)}
                </span>
              )}
              {agentPreview && (
                <span className="turn-list__row-preview">{truncate(agentPreview, 80)}</span>
              )}
              {hasDetail && (
                <button
                  className="turn-list__detail-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTurn(i);
                  }}
                >
                  Detail <ForwardIcon />
                </button>
              )}
            </div>
          </div>
        );
      })}
      {turns.length === 0 && <div className="turn-list__empty">No turns in this session.</div>}
    </div>
  );
}
