import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/invoke";
import { PopoutModal } from "./PopoutModal";
import type { SettingsResponse } from "../../shared/types";

import type { ThemeMode } from "../hooks/useTheme";

type SettingsModalProps = Readonly<{
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  onClose: () => void;
  onSaved: (dir: string) => void;
}>;

export function SettingsModal({
  themeMode,
  onThemeModeChange,
  onClose,
  onSaved,
}: SettingsModalProps) {
  const [sessionsDir, setSessionsDir] = useState("");
  const [defaultDir, setDefaultDir] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke<SettingsResponse>("get_settings")
      .then((res) => {
        setDefaultDir(res.default_dir);
        setSessionsDir(res.sessions_dir ?? res.default_dir);
      })
      .catch(console.error);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const trimmed = sessionsDir.trim();
      await invoke<SettingsResponse>("set_sessions_dir", { path: trimmed || null });
      onSaved(trimmed || defaultDir);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [sessionsDir, defaultDir, onSaved, onClose]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const res = await invoke<SettingsResponse>("set_sessions_dir", { path: null });
      setSessionsDir(res.default_dir);
      onSaved(res.default_dir);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [onSaved, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  return (
    <PopoutModal
      onClose={onClose}
      header={<span className="settings-modal__title">Settings</span>}
      initialWidth={520}
      initialHeight={260}
    >
      <div className="settings-modal">
        <label className="settings-modal__label" htmlFor="sessions-dir">
          Sessions Directory
        </label>
        <input
          id="sessions-dir"
          className="settings-modal__input"
          type="text"
          value={sessionsDir}
          onChange={(e) => {
            setSessionsDir(e.target.value);
            setError("");
          }}
          onKeyDown={handleKeyDown}
          placeholder={defaultDir}
          spellCheck={false}
          autoFocus
        />
        <p className="settings-modal__hint">Default: {defaultDir}</p>

        <label className="settings-modal__label" htmlFor="theme-mode">
          Theme
        </label>

        <select
          id="theme-mode"
          className="settings-modal__input"
          value={themeMode}
          onChange={(e) => onThemeModeChange(e.target.value as ThemeMode)}
        >
          <option value="system">System</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>


        {error && <p className="settings-modal__error">{error}</p>}
        <div className="settings-modal__actions">
          <button
            className="settings-modal__btn settings-modal__btn--secondary"
            onClick={handleReset}
            disabled={saving}
          >
            Reset to Default
          </button>
          <button
            className="settings-modal__btn settings-modal__btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            Save
          </button>
        </div>
      </div>
    </PopoutModal>
  );
}
