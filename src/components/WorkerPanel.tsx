import { useMemo, useState, useCallback } from "react";
import type { CodexSession } from "../../shared/types";
import { shortPath } from "../../shared/format";
import { CloseIcon } from "./Icons";
import { ToolCallItem } from "./ToolCallItem";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { formatExactTime } from "../lib/format";

interface WorkerPanelProps {
  session: CodexSession;
  nickname?: string;
  loading?: boolean;
  onClose: () => void;
}

function panelTitle(session: CodexSession, nickname?: string): string {
  if (nickname) return nickname;
  if (session.thread_name) return session.thread_name;
  if (session.cwd) return shortPath(session.cwd);
  return session.id.slice(0, 8);
}

export function WorkerPanel({ session, nickname, loading, onClose }: WorkerPanelProps) {
  const title = useMemo(() => panelTitle(session, nickname), [session, nickname]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleTool = useCallback((turnId: string, toolIdx: number) => {
    const key = `${turnId}:${toolIdx}`;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="worker-panel">
      <div className="worker-panel__header">
        <button className="worker-panel__close" onClick={onClose} title="Close panel">
          <CloseIcon />
        </button>
        <span className="worker-panel__badge">worker</span>
        <span className="worker-panel__title">{title}</span>
      </div>

      <div className="worker-panel__body">
        {loading && <div className="worker-panel__loading">Loading…</div>}

        {!loading &&
          session.turns.map((turn, ti) => {
            const commentary = turn.agent_messages.filter(
              (m) => m.phase !== "final_answer" && !m.is_reasoning,
            );
            const finalAnswer = turn.agent_messages.find((m) => m.phase === "final_answer");

            return (
              <div key={turn.turn_id} className="worker-panel__turn">
                {session.turns.length > 1 && (
                  <div className="worker-panel__turn-label">Turn {ti + 1}</div>
                )}

                {commentary.map((msg, i) => (
                  <div key={msg.timestamp ?? i} className="turn-detail__msg">
                    {msg.timestamp && (
                      <div className="turn-detail__msg-header">
                        <span className="turn-detail__msg-time">
                          {formatExactTime(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <div className="turn-detail__markdown">
                      <MarkdownRenderer content={msg.text} />
                    </div>
                  </div>
                ))}

                {finalAnswer && (
                  <div className="turn-detail__section turn-detail__section--final">
                    <div className="turn-detail__section-label">Final answer</div>
                    <div className="turn-detail__msg">
                      {finalAnswer.timestamp && (
                        <div className="turn-detail__msg-header">
                          <span className="turn-detail__msg-time">
                            {formatExactTime(finalAnswer.timestamp)}
                          </span>
                        </div>
                      )}
                      <div className="turn-detail__markdown">
                        <MarkdownRenderer content={finalAnswer.text} />
                      </div>
                    </div>
                  </div>
                )}

                {turn.tool_calls.length > 0 && (
                  <div className="turn-detail__section turn-detail__section--tools">
                    <div className="turn-detail__section-label">
                      Tool calls ({turn.tool_calls.length})
                    </div>
                    {turn.tool_calls.map((tool, i) => {
                      const key = `${turn.turn_id}:${i}`;
                      return (
                        <ToolCallItem
                          key={tool.call_id || i}
                          tool={tool}
                          expanded={expanded.has(key)}
                          onToggle={() => toggleTool(turn.turn_id, i)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
