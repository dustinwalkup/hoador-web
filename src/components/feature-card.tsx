import type { ReactNode } from "react";
import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  benefits: string[];
  variant?: "default" | "primary";
}

export default function FeatureCard({
  icon,
  title,
  description,
  benefits,
  variant = "default",
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-8 shadow-sm",
        variant === "default"
          ? "bg-card"
          : "bg-primary text-primary-foreground",
      )}
    >
      <div className="mb-6 flex justify-center">{icon}</div>
      <h3 className="mb-4 text-center text-2xl font-semibold">{title}</h3>
      <p
        className={cn(
          "text-center text-lg",
          variant === "default"
            ? "text-muted-foreground"
            : "text-primary-foreground/90",
        )}
      >
        {description}
      </p>
      <div className="mt-8 space-y-4">
        {benefits.map((benefit, index) => (
          <div key={index} className="flex items-start gap-3">
            <CheckCircle
              className={cn(
                "h-6 w-6 shrink-0",
                variant === "default" ? "text-primary" : "",
              )}
            />
            <p>{benefit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
