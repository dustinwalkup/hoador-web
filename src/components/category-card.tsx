import type { ReactNode } from "react";
import Image from "next/image";

interface CategoryCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  imageUrl: string;
}

export default function CategoryCard({
  icon,
  title,
  description,
  imageUrl,
}: CategoryCardProps) {
  return (
    <div className="group bg-card flex flex-grow flex-col rounded-xl border p-6 shadow-sm transition-all hover:shadow-md">
      <div className="bg-primary/10 text-primary mb-4 rounded-full p-3">
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      <Image
        src={imageUrl || "/globe.svg"}
        alt={title}
        width={320}
        height={180}
        className="w-full flex-1 rounded-lg object-cover"
      />
    </div>
  );
}
