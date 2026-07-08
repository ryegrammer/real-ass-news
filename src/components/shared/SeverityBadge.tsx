import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Fireboard severity levels for safety concerns.
 */
export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

/**
 * Ship Desk triage levels for problem-solving categorization.
 * Maps to NHTS methodology:
 * - human-now: L1 Human-Solvable Now
 * - human-learn: L2 Human-Solvable With Learning
 * - machine-required: L3 Machine-Required (Existing Tech)
 * - machine-quest: L4 Machine-Quest (Future Tech)
 */
export type TriageLevel = "human-now" | "human-learn" | "machine-required" | "machine-quest";

type Level = SeverityLevel | TriageLevel;

/**
 * Props for SeverityBadge component.
 */
interface SeverityBadgeProps {
  /** Severity or triage level determining badge color */
  level: Level;
  /** Optional custom content (defaults to level name) */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

const levelStyles: Record<Level, string> = {
  // Severity levels (Fireboard)
  critical: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  high: "bg-orange-500 text-white hover:bg-orange-500/90",
  medium: "bg-yellow-500 text-black hover:bg-yellow-500/90",
  low: "bg-green-500 text-white hover:bg-green-500/90",
  info: "bg-blue-500 text-white hover:bg-blue-500/90",
  // Triage levels (Ship Desk mapping)
  "human-now": "bg-green-500 text-white hover:bg-green-500/90",
  "human-learn": "bg-yellow-500 text-black hover:bg-yellow-500/90",
  "machine-required": "bg-orange-500 text-white hover:bg-orange-500/90",
  "machine-quest": "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

/**
 * Color-coded badge for displaying severity or triage levels.
 * Supports both Fireboard safety levels and Ship Desk triage categories.
 *
 * @example
 * ```tsx
 * <SeverityBadge level="critical">Urgent</SeverityBadge>
 * <SeverityBadge level="human-now" />
 * ```
 */
export const SeverityBadge = ({ level, children, className }: SeverityBadgeProps) => {
  return (
    <Badge className={cn(levelStyles[level], className)}>
      {children ?? level}
    </Badge>
  );
};
