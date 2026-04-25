import { useRef, useEffect } from "react";
import type { CodexSessionInfo } from "../../shared/types";
import { formatTokens, shortPath, timeAgo, truncate } from "../../shared/format";
import { OngoingDots } from "./OngoingDots";

interface SessionPickerProps {
  sessions: CodexSessionInfo[];
  loading: boolean;
  searchQuery: string;
  selectedIndex: number;
  onSelectSession: (info: CodexSessionInfo) => void;
  onSearchChange: (q: string) => void;
}

function sessionTitle(s: CodexSessionInfo): string {
  if (s.thread_name) return s.thread_name;
  if (s.cwd) return shortPath(s.cwd);
  return s.id.slice(0, 12);
}

export function SessionPicker({
  sessions,
  loading,
  searchQuery,
  selectedIndex,
  onSelectSession,
  onSearchChange,
}: SessionPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div className="session-picker">
      <div className="session-picker__search-row">
        <input
          ref={searchRef}
          className="session-picker__search"
          type="text"
          placeholder="Search sessions…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          spellCheck={false}
        />
      </div>
      {loading && <div className="session-picker__loading">Loading…</div>}
      <div ref={listRef} className="session-picker__list">
        {sessions.map((s, i) => (
          <div
            key={s.path}
            className={`session-picker__item${i === selectedIndex ? " session-picker__item--selected" : ""}`}
            onClick={() => onSelectSession(s)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelectSession(s);
            }}
          >
            <div className="session-picker__item-header">
              <span className="session-picker__title">{sessionTitle(s)}</span>
              {s.is_ongoing && <OngoingDots count={3} />}
              {s.git_branch && <span className="session-picker__branch">{s.git_branch}</span>}
            </div>
            <div className="session-picker__item-meta">
              {s.model && <span className="session-picker__model">{s.model}</span>}
              {s.cwd && (
                <span className="session-picker__cwd" title={s.cwd}>
                  {truncate(s.cwd, 60)}
                </span>
              )}
              <span className="session-picker__time">{timeAgo(s.start_time)}</span>
              {s.turn_count > 0 && (
                <span className="session-picker__turns">{s.turn_count} turns</span>
              )}
              {(s.total_tokens ?? 0) > 0 && (
                <span className="session-picker__tokens">{formatTokens(s.total_tokens!)} tok</span>
              )}
              {s.spawned_worker_ids.length > 0 && (
                <span className="session-picker__badge session-picker__badge--collab">
                  +{s.spawned_worker_ids.length} workers
                </span>
              )}
              {s.is_external_worker && (
                <span className="session-picker__badge session-picker__badge--worker">
                  [worker]
                </span>
              )}
            </div>
          </div>
        ))}
        {!loading && sessions.length === 0 && (
          <div className="session-picker__empty">No sessions found.</div>
        )}
      </div>
    </div>
  );
}
