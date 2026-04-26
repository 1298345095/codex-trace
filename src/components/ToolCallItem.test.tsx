import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CodexToolCall } from "../../shared/types";
import { ToolCallItem } from "./ToolCallItem";

function makeTool(overrides: Partial<CodexToolCall> = {}): CodexToolCall {
  return {
    call_id: "call-1",
    kind: "exec_command",
    name: "shell",
    arguments: {},
    input_text: null,
    output: "hello output",
    exit_code: 0,
    command: ["echo", "hello"],
    cwd: "/tmp",
    duration_secs: 0.5,
    mcp_server: null,
    mcp_tool: null,
    patch_success: null,
    patch_changes: null,
    web_query: null,
    web_url: null,
    image_prompt: null,
    status: "completed",
    ...overrides,
  };
}

describe("ToolCallItem", () => {
  it("renders the tool name in the header", () => {
    render(<ToolCallItem tool={makeTool()} expanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("shell")).toBeInTheDocument();
  });

  it("calls onToggle when the header is clicked", () => {
    const onToggle = vi.fn();
    render(<ToolCallItem tool={makeTool()} expanded={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("shell").closest(".tool-call__header")!);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows the command and output when expanded", () => {
    render(<ToolCallItem tool={makeTool()} expanded={true} onToggle={vi.fn()} />);
    expect(screen.getByText("echo hello")).toBeInTheDocument();
    expect(screen.getByText("hello output")).toBeInTheDocument();
  });

  it("hides command and output when collapsed", () => {
    render(<ToolCallItem tool={makeTool()} expanded={false} onToggle={vi.fn()} />);
    expect(screen.queryByText("hello output")).not.toBeInTheDocument();
  });

  it("shows the exit code in the header", () => {
    render(<ToolCallItem tool={makeTool({ exit_code: 1 })} expanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("exit 1")).toBeInTheDocument();
  });

  it("does not show exit code when exit_code is null", () => {
    render(
      <ToolCallItem tool={makeTool({ exit_code: null })} expanded={false} onToggle={vi.fn()} />,
    );
    expect(screen.queryByText(/exit/)).not.toBeInTheDocument();
  });

  it("applies tool-call--failed class on non-zero exit code", () => {
    const { container } = render(
      <ToolCallItem tool={makeTool({ exit_code: 1 })} expanded={false} onToggle={vi.fn()} />,
    );
    expect(container.querySelector(".tool-call--failed")).toBeInTheDocument();
  });

  it("does not apply failed class on zero exit code", () => {
    const { container } = render(
      <ToolCallItem tool={makeTool({ exit_code: 0 })} expanded={false} onToggle={vi.fn()} />,
    );
    expect(container.querySelector(".tool-call--failed")).not.toBeInTheDocument();
  });

  it("renders formatted duration in the header", () => {
    render(
      <ToolCallItem tool={makeTool({ duration_secs: 0.5 })} expanded={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByText("500ms")).toBeInTheDocument();
  });

  it("places duration left of the popout button in DOM order", () => {
    const { container } = render(
      <ToolCallItem tool={makeTool({ duration_secs: 0.5 })} expanded={false} onToggle={vi.fn()} />,
    );
    const header = container.querySelector(".tool-call__header")!;
    const children = Array.from(header.children);
    const durIdx = children.findIndex((el) => el.classList.contains("tool-call__duration"));
    const popoutIdx = children.findIndex((el) => el.classList.contains("tool-call__popout-btn"));
    expect(durIdx).toBeGreaterThanOrEqual(0);
    expect(durIdx).toBeLessThan(popoutIdx);
  });

  it("applies push class to popout button when there is no duration", () => {
    const { container } = render(
      <ToolCallItem tool={makeTool({ duration_secs: null })} expanded={false} onToggle={vi.fn()} />,
    );
    expect(container.querySelector(".tool-call__popout-btn--push")).toBeInTheDocument();
  });

  it("applies error class to output on non-zero exit code", () => {
    const { container } = render(
      <ToolCallItem tool={makeTool({ exit_code: 2 })} expanded={true} onToggle={vi.fn()} />,
    );
    expect(container.querySelector(".tool-call__output--error")).toBeInTheDocument();
  });

  it("renders MCP server in header prefix and expanded body", () => {
    const { container } = render(
      <ToolCallItem
        tool={makeTool({
          kind: "mcp_tool",
          name: "github_search_prs",
          mcp_server: "codex_apps",
          mcp_tool: "github_search_prs",
        })}
        expanded={true}
        onToggle={vi.fn()}
      />,
    );
    const prefix = container.querySelector(".tool-call__mcp-prefix");
    expect(prefix).toBeInTheDocument();
    expect(prefix!.textContent).toBe("MCP codex_apps");
  });

  it("renders web query when kind is web_search", () => {
    render(
      <ToolCallItem
        tool={makeTool({
          kind: "web_search",
          name: "web_search",
          web_query: "rust serde docs",
          command: null,
          output: null,
          exit_code: null,
          duration_secs: null,
        })}
        expanded={true}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("rust serde docs")).toBeInTheDocument();
  });

  it("renders patch file paths when kind is patch_apply", () => {
    render(
      <ToolCallItem
        tool={makeTool({
          kind: "patch_apply",
          name: "apply_patch",
          patch_changes: {
            "src/main.rs": { type: "update", unified_diff: "@@ -1 +1 @@\n-old\n+new" },
          },
          command: null,
          exit_code: null,
        })}
        expanded={true}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("src/main.rs")).toBeInTheDocument();
  });

  it("pretty-prints JSON output when output is a JSON object", () => {
    const { container } = render(
      <ToolCallItem
        tool={makeTool({ output: '{"url":"https://example.com","number":42}' })}
        expanded={true}
        onToggle={vi.fn()}
      />,
    );
    const code = container.querySelector(".tool-call__output code");
    expect(code).toBeInTheDocument();
    expect(code!.textContent).toContain('"url"');
    expect(code!.textContent).toContain('"https://example.com"');
    expect(code!.textContent).toContain('"number"');
  });

  it("renders plain text output when output is not JSON", () => {
    const { container } = render(
      <ToolCallItem
        tool={makeTool({ output: "plain text output" })}
        expanded={true}
        onToggle={vi.fn()}
      />,
    );
    expect(container.querySelector(".tool-call__output code")).not.toBeInTheDocument();
    expect(screen.getByText("plain text output")).toBeInTheDocument();
  });

  it("renders plain text output when output is a JSON primitive", () => {
    const { container } = render(
      <ToolCallItem
        tool={makeTool({ output: '"just a string"' })}
        expanded={true}
        onToggle={vi.fn()}
      />,
    );
    expect(container.querySelector(".tool-call__output code")).not.toBeInTheDocument();
  });
});
