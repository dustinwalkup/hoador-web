"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NeedsFeedFilters } from "@/features/neighborhood-needs/hooks/use-needs";

interface NeedFiltersProps {
  filters: NeedsFeedFilters;
  onChange: (next: NeedsFeedFilters) => void;
}

const TYPE_OPTIONS = [
  { value: undefined, label: "All" },
  { value: "rental" as const, label: "Rental" },
  { value: "service" as const, label: "Service" },
];

export function NeedFilters({ filters, onChange }: NeedFiltersProps) {
  const openOnly = filters.openOnly ?? true;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1">
        {TYPE_OPTIONS.map((opt) => (
          <Button
            key={opt.label}
            variant={filters.type === opt.value ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-8 text-xs",
              filters.type !== opt.value && "bg-transparent",
            )}
            onClick={() => onChange({ ...filters, type: opt.value })}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="open-only"
          checked={openOnly}
          onCheckedChange={(checked) =>
            onChange({ ...filters, openOnly: checked })
          }
        />
        <Label htmlFor="open-only" className="cursor-pointer text-sm">
          Open only
        </Label>
      </div>
    </div>
  );
}
