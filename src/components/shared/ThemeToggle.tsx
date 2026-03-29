import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { LucideIcon } from "lucide-react";

interface ThemeToggleProps {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  icon: LucideIcon;
  label: string;
  id?: string;
}

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
