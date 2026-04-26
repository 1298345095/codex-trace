import { useState, useEffect, useCallback, useRef } from "react";
import type { ViewState, CodexSessionInfo } from "../shared/types";
import { useSession } from "./hooks/useSession";
import { usePicker, resolveSessionsDir } from "./hooks/usePicker";
import { useToggleSet } from "./hooks/useToggleSet";
import { useKeyboard } from "./hooks/useKeyboard";
import { SidebarTree } from "./components/SidebarTree";
import { SessionPicker } from "./components/SessionPicker";
import { TurnList } from "./components/TurnList";
import { TurnDetail } from "./components/TurnDetail";
import { InfoBar } from "./components/InfoBar";
import { KeybindBar } from "./components/KeybindBar";
import { ViewToolbar } from "./components/ViewToolbar";
import { ResizeHandle } from "./components/ResizeHandle";
import { SettingsModal } from "./components/SettingsModal";

export function App() {
  const [view, setView] = useState<ViewState>("picker");
  const [selectedTurn, setSelectedTurn] = useState(0);
  const [pickerSelected, setPickerSelected] = useState(0);
  const [showKeybinds, setShowKeybinds] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [showSettings, setShowSettings] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  const session = useSession();
  const picker = usePicker();
  const {
    set: expandedTools,
    toggle: toggleTool,
    clear: clearTools,
    addAll: addAllTools,
  } = useToggleSet();

  const { loadSession } = session;
  const { discoverSessions, updateSessionOngoing } = picker;

  // Auto-discover sessions on mount
  const discoveredRef = useRef(false);
  useEffect(() => {
    if (discoveredRef.current) return;
    discoveredRef.current = true;
    resolveSessionsDir()
      .then((dir) => {
        if (dir) discoverSessions(dir);
      })
      .catch(() => setShowSettings(true));
  }, [discoverSessions]);

  // Sync session watcher ongoing status into picker
  useEffect(() => {
    if (session.sessionPath) {
      updateSessionOngoing(session.sessionPath, session.session?.is_ongoing ?? false);
    }
  }, [session.sessionPath, session.session?.is_ongoing, updateSessionOngoing]);

  const handleSelectSession = useCallback(
    (info: CodexSessionInfo) => {
      loadSession(info.path);
      setView("list");
      setSelectedTurn(0);
      clearTools();
    },
    [loadSession, clearTools],
  );

  const handleOpenDetail = useCallback((index: number) => {
    setSelectedTurn(index);
    setView("detail");
  }, []);

  const handleToggleDate = useCallback((dateGroup: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateGroup)) next.delete(dateGroup);
      else next.add(dateGroup);
      return next;
    });
  }, []);

  const turns = session.session?.turns ?? [];

  const expandAll = useCallback(() => {
    if (view === "detail") {
      const currentTurns = session.session?.turns ?? [];
      if (currentTurns[selectedTurn]) {
        addAllTools(currentTurns[selectedTurn].tool_calls.map((_, i) => i));
      }
    }
  }, [view, session.session, selectedTurn, addAllTools]);

  const collapseAll = useCallback(() => clearTools(), [clearTools]);

  const goToSessions = useCallback(() => setView("picker"), []);

  const handleLoadWorker = useCallback(
    (sessionId: string) => {
      const worker = picker.allSessions.find((s) => s.id === sessionId);
      if (worker) handleSelectSession(worker);
    },
    [picker.allSessions, handleSelectSession],
  );

  // Keyboard navigation
  useKeyboard({
    j: () => {
      if (view === "list") setSelectedTurn((i) => Math.min(i + 1, turns.length - 1));
      if (view === "picker") setPickerSelected((i) => Math.min(i + 1, picker.sessions.length - 1));
    },
    k: () => {
      if (view === "list") setSelectedTurn((i) => Math.max(i - 1, 0));
      if (view === "picker") setPickerSelected((i) => Math.max(i - 1, 0));
    },
    Enter: () => {
      if (view === "list" && turns.length > 0) handleOpenDetail(selectedTurn);
      if (view === "picker" && picker.sessions.length > 0)
        handleSelectSession(picker.sessions[pickerSelected]);
    },
    Escape: () => {
      if (view === "detail") setView("list");
      else if (view === "list") setView("picker");
    },
    q: () => {
      if (view === "detail") setView("list");
      else if (view === "list") setView("picker");
    },
    ",": () => setShowSettings(true),
    "?": () => setShowKeybinds((p) => !p),
  });

  return (
    <div className="app">
      {/* Info bar — only when session loaded and not in picker */}
      {session.sessionPath && view !== "picker" && session.session && (
        <InfoBar session={session.session} />
      )}

      {/* View toolbar */}
      <ViewToolbar
        view={view}
        hasSession={!!session.sessionPath}
        onGoToSessions={goToSessions}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="app-body">
        {/* Left sidebar */}
        <div className="app__sidebar" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
          <div className="app__sidebar-header">
            <span className="app__sidebar-title">SESSIONS</span>
          </div>
          <SidebarTree
            sessions={picker.allSessions}
            selectedPath={session.sessionPath || null}
            collapsedDates={collapsedDates}
            onSelectSession={handleSelectSession}
            onToggleDate={handleToggleDate}
          />
        </div>

        <ResizeHandle onResize={setSidebarWidth} />

        {/* Main content */}
        <div className="main-content">
          {view === "picker" && (
            <SessionPicker
              sessions={picker.sessions}
              loading={picker.loading}
              searchQuery={picker.searchQuery}
              selectedIndex={pickerSelected}
              onSelectSession={handleSelectSession}
              onSearchChange={picker.setSearchQuery}
            />
          )}

          {view === "list" && session.loading && (
            <div className="app__loading">Loading session…</div>
          )}

          {view === "list" && !session.loading && session.session && (
            <TurnList
              turns={turns}
              selectedIndex={selectedTurn}
              onSelectTurn={(i) => {
                setSelectedTurn(i);
                setView("detail");
              }}
            />
          )}

          {view === "detail" && turns[selectedTurn] && (
            <TurnDetail
              turn={turns[selectedTurn]}
              expanded={expandedTools}
              onToggle={toggleTool}
              onBack={() => setView("list")}
              onLoadWorker={handleLoadWorker}
            />
          )}
        </div>
      </div>

      {/* Bottom keybind bar */}
      <KeybindBar
        view={view}
        showHints={showKeybinds}
        onToggle={() => setShowKeybinds((p) => !p)}
      />

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSaved={(dir) => {
            discoverSessions(dir);
          }}
        />
      )}
    </div>
  );
}
