import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";
export type TriageLevel = "human-now" | "human-learn" | "machine-required" | "machine-quest";
type Level = SeverityLevel | TriageLevel;

interface SeverityBadgeProps {
  level: Level;
  children?: React.ReactNode;
  className?: string;
}

const levelStyles: Record<Level, string> = {
  critical: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  high: "bg-orange-500 text-white hover:bg-orange-500/90",
  medium: "bg-yellow-500 text-black hover:bg-yellow-500/90",
  low: "bg-green-500 text-white hover:bg-green-500/90",
  info: "bg-blue-500 text-white hover:bg-blue-500/90",
  "human-now": "bg-green-500 text-white hover:bg-green-500/90",
  "human-learn": "bg-yellow-500 text-black hover:bg-yellow-500/90",
  "machine-required": "bg-orange-500 text-white hover:bg-orange-500/90",
  "machine-quest": "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

export const SeverityBadge = ({ level, children, className }: SeverityBadgeProps) => {
  return (
    <Badge className={cn(levelStyles[level], className)}>
      {children ?? level}
    </Badge>
  );
};
