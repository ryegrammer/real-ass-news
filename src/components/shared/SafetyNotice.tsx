import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NoticeVariant = "warning" | "critical" | "info";

interface SafetyNoticeProps {
  variant: NoticeVariant;
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
}

const variantConfig: Record<NoticeVariant, {
  defaultIcon: LucideIcon;
  alertVariant: "default" | "destructive";
  classes: string;
}> = {
  critical: {
    defaultIcon: ShieldAlert,
    alertVariant: "destructive",
    classes: "border-destructive/50 bg-destructive/10",
  },
  warning: {
    defaultIcon: AlertTriangle,
    alertVariant: "default",
    classes: "border-amber-500/50 bg-amber-500/10",
  },
  info: {
    defaultIcon: Info,
    alertVariant: "default",
    classes: "border-blue-500/50 bg-blue-500/10",
  },
};

export const SafetyNotice = ({
  variant,
  title,
  description,
  icon,
  className,
}: SafetyNoticeProps) => {
  const config = variantConfig[variant];
  const IconComponent = icon ?? config.defaultIcon;

  return (
    <Alert
      variant={config.alertVariant}
      className={cn(config.classes, className)}
    >
      <IconComponent className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
};
