"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/icon";

interface CategoryCardProps {
  iconName: string;
  title: string;
  description: string;
  imageUrl: string;
}

export default function CategoryCard({
  iconName,
  title,
  description,
  imageUrl,
}: CategoryCardProps) {
  return (
    <motion.div
      className="group bg-card flex h-full grow flex-col rounded-xl border p-6 shadow-sm"
      whileHover={{
        y: -8,
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.1)",
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <motion.div
        className="bg-primary/10 text-primary mb-4 w-fit rounded-full p-3"
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ duration: 0.2 }}
      >
        <Icon name={iconName} className="h-6 w-6" />
      </motion.div>
      <h3 className="mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      <motion.div
        className="relative mt-auto aspect-[13/9] w-full overflow-hidden rounded-lg"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.3 }}
      >
        <Image
          src={imageUrl || "/globe.svg"}
          alt={title}
          fill
          sizes="(max-width: 768px) 82vw, (max-width: 1024px) 45vw, 32vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </motion.div>
    </motion.div>
  );
}
