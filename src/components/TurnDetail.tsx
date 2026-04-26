import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { CodexTurn } from "../../shared/types";
import { TokenBar } from "./TokenBar";
import { ToolCallItem } from "./ToolCallItem";
import { OngoingDots } from "./OngoingDots";

interface TurnDetailProps {
  turn: CodexTurn;
  expanded: Set<number>;
  onToggle: (i: number) => void;
  onLoadWorker?: (sessionId: string) => void;
}

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children }) {
          const match = /language-(\w+)/.exec(className ?? "");
          const lang = match ? match[1] : "";
          const code = String(children).replace(/\n$/, "");
          if (lang) {
            return (
              <SyntaxHighlighter language={lang} style={oneDark} PreTag="div">
                {code}
              </SyntaxHighlighter>
            );
          }
          return <code className={className}>{children}</code>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function TurnDetail({ turn, expanded, onToggle, onLoadWorker }: TurnDetailProps) {
  const commentary = turn.agent_messages.filter(
    (m) => m.phase !== "final_answer" && !m.is_reasoning,
  );
  const reasoning = turn.agent_messages.filter((m) => m.is_reasoning);
  const finalAnswer = turn.agent_messages.find((m) => m.phase === "final_answer");

  return (
    <div className="turn-detail">
      <div className="turn-detail__header">
        <span className="turn-detail__status">
          {turn.status === "ongoing" ? <OngoingDots count={5} /> : turn.status}
        </span>
        {turn.model && <span className="turn-detail__model">{turn.model}</span>}
        {turn.reasoning_effort && (
          <span className="turn-detail__effort">{turn.reasoning_effort}</span>
        )}
        {turn.total_tokens && <TokenBar tokens={turn.total_tokens} />}
      </div>

      {turn.user_message && (
        <div className="turn-detail__section turn-detail__section--user">
          <div className="turn-detail__section-label">User</div>
          <div className="turn-detail__markdown">
            <MarkdownRenderer content={turn.user_message} />
          </div>
        </div>
      )}

      {turn.error && (
        <div className="turn-detail__section turn-detail__section--error">
          <div className="turn-detail__section-label">Error</div>
          <pre className="turn-detail__error">{turn.error}</pre>
        </div>
      )}

      {reasoning.length > 0 && (
        <div className="turn-detail__section turn-detail__section--reasoning">
          <div className="turn-detail__section-label" style={{ color: "var(--reasoning-text)" }}>
            Reasoning (encrypted)
          </div>
          <div className="turn-detail__reasoning-note">(reasoning encrypted — cannot display)</div>
        </div>
      )}

      {commentary.length > 0 && (
        <div className="turn-detail__section turn-detail__section--commentary">
          <div className="turn-detail__section-label">Commentary</div>
          {commentary.map((msg, i) => (
            <div key={msg.timestamp ?? i} className="turn-detail__markdown">
              <MarkdownRenderer content={msg.text} />
            </div>
          ))}
        </div>
      )}

      {turn.tool_calls.length > 0 && (
        <div className="turn-detail__section turn-detail__section--tools">
          <div className="turn-detail__section-label">Tool calls ({turn.tool_calls.length})</div>
          {turn.tool_calls.map((tool, i) => (
            <ToolCallItem
              key={tool.call_id || i}
              tool={tool}
              expanded={expanded.has(i)}
              onToggle={() => onToggle(i)}
            />
          ))}
        </div>
      )}

      {turn.collab_spawns.length > 0 && (
        <div className="turn-detail__section turn-detail__section--collab">
          <div className="turn-detail__section-label" style={{ color: "var(--collab-badge)" }}>
            Spawned workers ({turn.collab_spawns.length})
          </div>
          {turn.collab_spawns.map((spawn) => (
            <div key={spawn.call_id} className="turn-detail__collab-spawn">
              <div className="turn-detail__collab-header">
                <span className="turn-detail__collab-nick">{spawn.agent_nickname}</span>
                {spawn.model && <span className="turn-detail__collab-model">{spawn.model}</span>}
                {onLoadWorker && (
                  <button
                    className="turn-detail__collab-btn"
                    onClick={() => onLoadWorker(spawn.new_thread_id)}
                    title="Open worker session"
                  >
                    Open ↗
                  </button>
                )}
              </div>
              {spawn.prompt_preview && (
                <pre className="turn-detail__collab-prompt">{spawn.prompt_preview}</pre>
              )}
            </div>
          ))}
        </div>
      )}

      {finalAnswer && (
        <div className="turn-detail__section turn-detail__section--final">
          <div className="turn-detail__section-label">Final answer</div>
          <div className="turn-detail__markdown">
            <MarkdownRenderer content={finalAnswer.text} />
          </div>
        </div>
      )}

      {turn.has_compaction && (
        <div className="turn-detail__compaction-note">Context was compacted in this turn.</div>
      )}
    </div>
  );
}
