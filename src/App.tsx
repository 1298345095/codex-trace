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
  const { clear: clearTools } = useToggleSet();

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
  });

  return (
    <div className="app">
      {/* Left sidebar */}
      <div className="app__sidebar" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
        <div className="app__sidebar-header">
          <span className="app__sidebar-title">Codex Trace</span>
          <button
            className="app__settings-btn"
            onClick={() => setShowSettings(true)}
            title="Settings (,)"
          >
            ⚙
          </button>
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
      <div className="app__main">
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

        {(view === "list" || view === "detail") && session.session && (
          <>
            <InfoBar session={session.session} />
            <div className="app__panels">
              <div className="app__turn-list">
                <TurnList
                  turns={turns}
                  selectedIndex={selectedTurn}
                  onSelectTurn={(i) => {
                    setSelectedTurn(i);
                    if (view !== "detail") setView("detail");
                  }}
                />
              </div>
              {view === "detail" && turns[selectedTurn] && (
                <>
                  <ResizeHandle onResize={() => {}} />
                  <div className="app__turn-detail">
                    <TurnDetail turn={turns[selectedTurn]} />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {(view === "list" || view === "detail") && session.loading && (
          <div className="app__loading">Loading session…</div>
        )}
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
