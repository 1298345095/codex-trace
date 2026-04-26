import {
  VscTerminalBash,
  VscGlobe,
  VscPlug,
  VscTriangleRight,
  VscRefresh,
  VscArrowLeft,
  VscArrowRight,
  VscChevronRight,
  VscHubot,
  VscWarning,
  VscAccount,
  VscTools,
  VscWatch,
  VscLightbulbEmpty,
} from "react-icons/vsc";
import { MdOutlineGeneratingTokens } from "react-icons/md";
import { GoGitMerge } from "react-icons/go";
import { AiOutlineRobot } from "react-icons/ai";
import { MdOutlineImage } from "react-icons/md";

export function ExecIcon() {
  return <VscTerminalBash className="icon--bash" />;
}

export function McpIcon() {
  return <VscPlug className="icon--mcp" />;
}

export function PatchIcon() {
  return <GoGitMerge className="icon--git" />;
}

export function WebIcon() {
  return <VscGlobe className="icon--web" />;
}

export function ImageIcon() {
  return <MdOutlineImage style={{ color: "var(--icon-image, #af5fff)" }} />;
}

export function SpawnIcon() {
  return <VscHubot className="icon--spawn" />;
}

export function WaitIcon() {
  return <AiOutlineRobot className="icon--agents" />;
}

export function CloseAgentIcon() {
  return <AiOutlineRobot className="icon--agents" />;
}

export function UnknownToolIcon() {
  return <VscTriangleRight className="icon--tool" />;
}

export function WarningIcon() {
  return <VscWarning className="icon--warning" />;
}

export function BackIcon() {
  return <VscArrowLeft />;
}

export function RefreshIcon() {
  return <VscRefresh />;
}

export function ChevronIcon() {
  return <VscChevronRight />;
}

export function UserIcon() {
  return <VscAccount className="icon--user" />;
}

export function CodexIcon() {
  return <VscHubot className="icon--codex" />;
}

export function ForwardIcon() {
  return <VscArrowRight />;
}

export function TokensIcon() {
  return <MdOutlineGeneratingTokens className="icon--tokens" />;
}

export function ToolsIcon() {
  return <VscTools className="icon--tool" />;
}

export function DurationIcon() {
  return <VscWatch className="icon--duration" />;
}

export function ThinkingIcon() {
  return <VscLightbulbEmpty className="icon--thinking" />;
}
