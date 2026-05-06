import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info, ShieldAlert, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SafetyNoticeStat {
  icon: React.ReactNode;
  label: string;
  value: string;
}

type NoticeVariant = "warning" | "critical" | "info" | "advisory";

interface SafetyNoticeProps {
  variant: NoticeVariant;
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
  id?: string;
  location?: string;
  stats?: SafetyNoticeStat[];
  dismissible?: boolean;
  linkTo?: string;
  linkLabel?: string;
  onNavigate?: (path: string) => void;
}

const variantConfig: Record<NoticeVariant, {
  defaultIcon: LucideIcon;
  alertVariant: "default" | "destructive";
  classes: string;
  badgeText?: string;
  badgeClass?: string;
}> = {
  critical: {
    defaultIcon: ShieldAlert,
    alertVariant: "destructive",
    classes: "border-destructive/50 bg-destructive/10",
    badgeText: "Critical",
    badgeClass: "bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 rounded",
  },
  warning: {
    defaultIcon: AlertTriangle,
    alertVariant: "default",
    classes: "border-amber-500/50 bg-amber-500/10",
    badgeText: "Warning",
    badgeClass: "bg-amber-500 text-white text-[10px] px-1.5 py-0 rounded",
  },
  info: {
    defaultIcon: Info,
    alertVariant: "default",
    classes: "border-blue-500/50 bg-blue-500/10",
  },
  advisory: {
    defaultIcon: Info,
    alertVariant: "default",
    classes: "border-blue-500/50 bg-blue-500/10",
    badgeText: "Advisory",
    badgeClass: "bg-muted text-muted-foreground text-[10px] px-1.5 py-0 rounded",
  },
};

export const SafetyNotice = ({
  variant,
  title,
  description,
  icon,
  className,
  id,
  location,
  stats,
  dismissible = false,
  linkTo,
  linkLabel,
  onNavigate,
}: SafetyNoticeProps) => {
  const config = variantConfig[variant];
  const IconComponent = icon ?? config.defaultIcon;
  const hasEnhanced = stats || location || dismissible || linkTo;

  const storageKey = id ? `safety-notice-dismissed-${id}` : null;
  const [dismissed, setDismissed] = useState(() =>
    storageKey ? sessionStorage.getItem(storageKey) === "true" : false
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    if (storageKey) sessionStorage.setItem(storageKey, "true");
    setDismissed(true);
  };

  if (!hasEnhanced) {
    return (
      <Alert
        variant={config.alertVariant}
        className={cn(config.classes, className)}
      >
        <IconComponent className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        {description && <AlertDescription>{description}</AlertDescription>}
      </Alert>
    );
  }

  return (
    <Alert
      variant={config.alertVariant}
      className={cn(config.classes, "relative", className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <IconComponent className="h-4 w-4 shrink-0" />
            <AlertTitle className="mb-0">{title}</AlertTitle>
            {config.badgeText && (
              <span className={config.badgeClass}>{config.badgeText}</span>
            )}
            {location && (
              <span className="text-xs text-muted-foreground">
                {location}
              </span>
            )}
          </div>

          {description && <AlertDescription>{description}</AlertDescription>}

          {stats && stats.length > 0 && (
            <AlertDescription>
              <div className="flex flex-wrap gap-3 text-sm">
                {stats.map((stat, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    {stat.icon}
                    <span className="font-medium">{stat.value}</span>
                    <span className="text-muted-foreground">{stat.label}</span>
                  </span>
                ))}
              </div>
            </AlertDescription>
          )}

          {linkTo && linkLabel && onNavigate && (
            <button
              type="button"
              className="text-sm underline-offset-4 hover:underline p-0"
              onClick={() => onNavigate(linkTo)}
            >
              {linkLabel} →
            </button>
          )}
        </div>

        {dismissible && (
          <button
            type="button"
            className="h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-sm opacity-70 hover:opacity-100"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </Alert>
  );
};
