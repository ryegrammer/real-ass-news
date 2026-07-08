import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for CollapsibleCard component.
 */
interface CollapsibleCardProps {
  /** Card header title */
  title: string;
  /** Optional inline text after title (muted style) */
  subtitle?: string;
  /** Optional description below title */
  description?: string;
  /** Optional Lucide icon for title */
  icon?: LucideIcon;
  /** Initial collapsed state (default: true) */
  defaultOpen?: boolean;
  /** Optional controls rendered in header right side */
  headerControls?: React.ReactNode;
  /** Card body content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable collapsible card component for high-density information layouts.
 * Designed for export to Ship Desk and other NHTS projects.
 *
 * @example
 * ```tsx
 * <CollapsibleCard title="Settings" icon={Settings} defaultOpen={false}>
 *   <p>Card content here</p>
 * </CollapsibleCard>
 * ```
 */

export const CollapsibleCard = ({
  title,
  subtitle,
  description,
  icon: Icon,
  defaultOpen = true,
  headerControls,
  children,
  className,
}: CollapsibleCardProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              {Icon && <Icon className="h-5 w-5 text-primary" />}
              {title}
              {subtitle && (
                <span className="text-sm font-normal text-muted-foreground">{subtitle}</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-4">
              {headerControls}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
