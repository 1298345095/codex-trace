import { useCallback } from "react";
import type { CodexSessionInfo } from "../../shared/types";
import { shortPath, timeAgo } from "../../shared/format";

interface SidebarTreeProps {
  sessions: CodexSessionInfo[];
  selectedPath: string | null;
  collapsedDates: Set<string>;
  onSelectSession: (info: CodexSessionInfo) => void;
  onToggleDate: (dateGroup: string) => void;
}

/** Group sessions by their date_group (YYYY/MM/DD), preserving sort order */
function groupByDate(sessions: CodexSessionInfo[]): Map<string, CodexSessionInfo[]> {
  const map = new Map<string, CodexSessionInfo[]>();
  for (const s of sessions) {
    const dg = s.date_group || "unknown";
    if (!map.has(dg)) map.set(dg, []);
    map.get(dg)!.push(s);
  }
  return map;
}

function sessionLabel(s: CodexSessionInfo): string {
  if (s.thread_name) return s.thread_name;
  if (s.cwd) return shortPath(s.cwd);
  return s.id.slice(0, 8);
}

export function SidebarTree({
  sessions,
  selectedPath,
  collapsedDates,
  onSelectSession,
  onToggleDate,
}: SidebarTreeProps) {
  const grouped = groupByDate(sessions);
  const handleToggle = useCallback(
    (e: React.MouseEvent, dateGroup: string) => {
      e.stopPropagation();
      onToggleDate(dateGroup);
    },
    [onToggleDate],
  );

  if (sessions.length === 0) {
    return (
      <div className="sidebar-tree sidebar-tree--empty">
        <span className="sidebar-tree__empty">No sessions</span>
      </div>
    );
  }

  return (
    <div className="sidebar-tree">
      {Array.from(grouped.entries()).map(([dateGroup, group]) => {
        const collapsed = collapsedDates.has(dateGroup);
        return (
          <div key={dateGroup} className="sidebar-tree__group">
            <div
              className="sidebar-tree__date-header"
              onClick={(e) => handleToggle(e, dateGroup)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onToggleDate(dateGroup);
              }}
            >
              <span className="sidebar-tree__chevron">{collapsed ? "▶" : "▼"}</span>
              <span className="sidebar-tree__date">{dateGroup}</span>
              <span className="sidebar-tree__count">{group.length}</span>
            </div>
            {!collapsed &&
              group.map((s) => {
                const isSelected = s.path === selectedPath;
                return (
                  <div
                    key={s.path}
                    className={`sidebar-tree__session${isSelected ? " sidebar-tree__session--selected" : ""}${s.is_ongoing ? " sidebar-tree__session--ongoing" : ""}`}
                    onClick={() => onSelectSession(s)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSelectSession(s);
                    }}
                  >
                    <div className="sidebar-tree__session-row">
                      <span className="sidebar-tree__session-label">{sessionLabel(s)}</span>
                      <span className="sidebar-tree__time">{timeAgo(s.start_time)}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
