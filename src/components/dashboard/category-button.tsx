import { cn } from "@/lib/utils";

interface CategoryButtonProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export default function CategoryButton({
  icon,
  label,
  active = false,
  onClick,
}: CategoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-full px-4 transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted/40 hover:bg-muted/60",
      )}
    >
      <span className="text-base">{icon}</span>
      <span className="line-clamp-1 text-xs font-medium">{label}</span>
    </button>
  );
}
