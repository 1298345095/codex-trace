import type { TokenInfo } from "../../shared/types";
import { formatTokens } from "../../shared/format";

interface TokenBarProps {
  tokens: TokenInfo;
}

export function TokenBar({ tokens }: TokenBarProps) {
  const {
    input_tokens,
    cached_input_tokens,
    output_tokens,
    reasoning_output_tokens,
    total_tokens,
    model_context_window,
  } = tokens;
  const pct =
    model_context_window > 0 ? Math.min(100, (total_tokens / model_context_window) * 100) : 0;

  return (
    <div
      className="token-bar"
      title={`${formatTokens(total_tokens)} / ${formatTokens(model_context_window)} tokens`}
    >
      <div className="token-bar__track">
        {model_context_window > 0 && (
          <div className="token-bar__fill" style={{ width: `${pct.toFixed(1)}%` }} />
        )}
      </div>
      <div className="token-bar__stats">
        <span style={{ color: "var(--token-input)" }}>in {formatTokens(input_tokens)}</span>
        {cached_input_tokens > 0 && (
          <span style={{ color: "var(--token-cached)" }}>
            cache {formatTokens(cached_input_tokens)}
          </span>
        )}
        <span style={{ color: "var(--token-output)" }}>out {formatTokens(output_tokens)}</span>
        {reasoning_output_tokens > 0 && (
          <span style={{ color: "var(--token-reasoning)" }}>
            think {formatTokens(reasoning_output_tokens)}
          </span>
        )}
      </div>
    </div>
  );
}
