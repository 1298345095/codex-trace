import type { CodexSession } from "../../shared/types";
import { formatTokens, shortPath, timeAgo } from "../../shared/format";
import { OngoingDots } from "./OngoingDots";

interface InfoBarProps {
  session: CodexSession;
}

export function InfoBar({ session }: InfoBarProps) {
  const cwd = session.cwd ? shortPath(session.cwd) : null;
  const branch = session.git?.branch ?? null;
  const totalTok = session.total_tokens?.total_tokens ?? 0;
  const model = session.turns.at(-1)?.model ?? null;

  return (
    <div className="info-bar">
      {cwd && <span className="info-bar__project">{cwd}</span>}
      {branch && <span className="info-bar__branch">{branch}</span>}
      {model && <span className="info-bar__session-id">{model}</span>}
      {totalTok > 0 && <span className="info-bar__tokens">{formatTokens(totalTok)} tok</span>}
      <span className="info-bar__session-id" style={{ marginLeft: "auto", opacity: 0.5 }}>
        {timeAgo(session.timestamp)}
      </span>
      {session.is_ongoing && (
        <span className="info-bar__ongoing">
          <OngoingDots count={3} /> active
        </span>
      )}
    </div>
  );
}
