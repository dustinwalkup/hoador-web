import { cn } from "@/lib/utils";

interface CategoryButtonProps {
  icon: string;
  label: string;
  active?: boolean;
}

export default function CategoryButton({
  icon,
  label,
  active = false,
}: CategoryButtonProps) {
  return (
    <button
      className={cn(
        "flex min-w-[100px] flex-col items-center rounded-lg border px-3 py-2 transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-background hover:border-primary/50 hover:bg-primary/5",
      )}
    >
      <span className="text-xl">{icon}</span>
      <span className="mt-1 text-xs font-medium">{label}</span>
    </button>
  );
}
