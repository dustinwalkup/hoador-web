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
        "flex items-center gap-2 rounded-lg border px-3 transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-background hover:border-primary/50 hover:bg-primary/5",
      )}
    >
      <span className="text-xl">{icon}</span>
      <span className="line-clamp-1 text-xs font-medium">{label}</span>
    </button>
  );
}
