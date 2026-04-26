import type { CodexSession } from "../../shared/types";
import { formatTokens, shortPath, timeAgo } from "../../shared/format";
import { shortModel } from "../lib/format";
import { getModelColor } from "../lib/theme";
import { OngoingDots } from "./OngoingDots";

interface InfoBarProps {
  session: CodexSession;
}

export function InfoBar({ session }: InfoBarProps) {
  const cwd = session.cwd ? shortPath(session.cwd) : null;
  const branch = session.git?.branch ?? null;
  const totalTok = session.total_tokens?.total_tokens ?? 0;
  const lastTurn = session.turns.at(-1);
  const model = lastTurn?.model ?? null;
  const modelClr = model ? getModelColor(model) : undefined;
  const sessionId = session.path.split("/").pop()?.replace(".jsonl", "") || session.id;

  return (
    <div className="info-bar">
      {cwd && <span className="info-bar__project">{cwd}</span>}
      {sessionId && <span className="info-bar__session-id">{sessionId}</span>}
      {branch && <span className="info-bar__branch">{branch}</span>}
      {model && (
        <span className="info-bar__model" style={{ color: modelClr }}>
          {shortModel(model)}
        </span>
      )}
      {totalTok > 0 && <span className="info-bar__tokens">{formatTokens(totalTok)} tok</span>}
      <span className="info-bar__time">{timeAgo(session.timestamp)}</span>
      {session.is_ongoing && (
        <span className="info-bar__ongoing">
          <OngoingDots count={3} /> active
        </span>
      )}
    </div>
  );
}
