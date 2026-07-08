import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { LucideIcon } from "lucide-react";

/**
 * Props for ThemeToggle component.
 */
interface ThemeToggleProps {
  /** Current toggle state */
  checked: boolean;
  /** Callback when toggle changes */
  onCheckedChange: (value: boolean) => void;
  /** Lucide icon displayed before label */
  icon: LucideIcon;
  /** Toggle label text */
  label: string;
  /** Optional HTML id for accessibility */
  id?: string;
}

/**
 * Reusable theme toggle component with icon and label.
 * Used for Cave theme and other boolean settings.
 *
 * @example
 * ```tsx
 * <ThemeToggle
 *   checked={darkMode}
 *   onCheckedChange={setDarkMode}
 *   icon={Moon}
 *   label="Dark Mode"
 * />
 * ```
 */

export const ThemeToggle = ({
  checked,
  onCheckedChange,
  icon: Icon,
  label,
  id = "theme-toggle",
}: ThemeToggleProps) => {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
};
