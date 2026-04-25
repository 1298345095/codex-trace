import { useCallback } from "react";
import type { CodexToolCall } from "../../shared/types";
import { formatDuration } from "../../shared/format";

interface ToolCallItemProps {
  tool: CodexToolCall;
  expanded: boolean;
  onToggle: () => void;
}

function kindLabel(kind: CodexToolCall["kind"]): string {
  switch (kind) {
    case "exec_command":
      return "exec";
    case "mcp_tool":
      return "mcp";
    case "patch_apply":
      return "patch";
    case "web_search":
      return "web";
    case "image_generation":
      return "image";
    case "spawn_agent":
      return "spawn";
    case "wait_agent":
      return "wait";
    case "close_agent":
      return "close";
    default:
      return "tool";
  }
}

function kindClass(kind: CodexToolCall["kind"]): string {
  switch (kind) {
    case "exec_command":
      return "tool-call--exec";
    case "mcp_tool":
      return "tool-call--mcp";
    case "patch_apply":
      return "tool-call--patch";
    case "web_search":
      return "tool-call--web";
    case "image_generation":
      return "tool-call--image";
    case "spawn_agent":
    case "wait_agent":
    case "close_agent":
      return "tool-call--collab";
    default:
      return "tool-call--unknown";
  }
}

export function ToolCallItem({ tool, expanded, onToggle }: ToolCallItemProps) {
  const handleToggle = useCallback(() => onToggle(), [onToggle]);

  const failed =
    (tool.exit_code !== null && tool.exit_code !== 0) ||
    tool.patch_success === false ||
    tool.status === "failed";

  return (
    <div className={`tool-call ${kindClass(tool.kind)}${failed ? " tool-call--failed" : ""}`}>
      <div
        className="tool-call__header"
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleToggle();
        }}
      >
        <span className="tool-call__kind">{kindLabel(tool.kind)}</span>
        <span className="tool-call__name">{tool.name}</span>
        {tool.exit_code !== null && (
          <span
            className={`tool-call__exit${tool.exit_code !== 0 ? " tool-call__exit--fail" : ""}`}
          >
            exit {tool.exit_code}
          </span>
        )}
        {tool.duration_secs !== null && (
          <span className="tool-call__duration">{formatDuration(tool.duration_secs * 1000)}</span>
        )}
        <span className="tool-call__chevron">{expanded ? "▼" : "▶"}</span>
      </div>

      {expanded && (
        <div className="tool-call__body">
          {tool.kind === "exec_command" && tool.command && (
            <pre className="tool-call__cmd">{tool.command.join(" ")}</pre>
          )}
          {tool.kind === "exec_command" && tool.cwd && (
            <div className="tool-call__cwd">cwd: {tool.cwd}</div>
          )}
          {tool.kind === "mcp_tool" && (
            <div className="tool-call__mcp-info">
              {tool.mcp_server && <span>server: {tool.mcp_server}</span>}
              {tool.mcp_tool && <span> tool: {tool.mcp_tool}</span>}
            </div>
          )}
          {tool.kind === "patch_apply" && tool.patch_changes && (
            <div className="tool-call__patch">
              {Object.entries(tool.patch_changes).map(([file, change]) => (
                <div key={file} className="tool-call__patch-file">
                  <span className={`tool-call__patch-type tool-call__patch-type--${change.type}`}>
                    {change.type}
                  </span>{" "}
                  {file}
                  {change.unified_diff && (
                    <pre className="tool-call__diff">{change.unified_diff}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
          {tool.kind === "web_search" && (
            <div className="tool-call__web">
              {tool.web_query && <div>query: {tool.web_query}</div>}
              {tool.web_url && <div>url: {tool.web_url}</div>}
            </div>
          )}
          {tool.kind === "image_generation" && tool.image_prompt && (
            <div className="tool-call__image-prompt">{tool.image_prompt}</div>
          )}
          {tool.kind === "spawn_agent" && (
            <div className="tool-call__collab-info" style={{ color: "var(--collab-badge)" }}>
              spawned agent
            </div>
          )}
          {tool.output !== null && <pre className="tool-call__output">{tool.output}</pre>}
        </div>
      )}
    </div>
  );
}
