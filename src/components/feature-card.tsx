"use client";

import { CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

interface FeatureCardProps {
  iconName: string;
  title: string;
  description: string;
  benefits: string[];
  variant?: "default" | "primary";
}

export default function FeatureCard({
  iconName,
  title,
  description,
  benefits,
  variant = "default",
}: FeatureCardProps) {
  return (
    <motion.div
      className={cn(
        "rounded-xl p-8 shadow-sm",
        variant === "default"
          ? "bg-card"
          : "bg-primary text-primary-foreground",
      )}
      whileHover={{
        y: -4,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <motion.div
        className="mb-6 flex justify-center"
        initial={{ scale: 0.8, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Icon name={iconName} className="h-12 w-12" />
      </motion.div>
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
      <motion.div
        className="mt-8 space-y-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: 0.1,
              delayChildren: 0.3,
            },
          },
        }}
      >
        {benefits.map((benefit, index) => (
          <motion.div
            key={index}
            className="flex items-start gap-3"
            variants={{
              hidden: { opacity: 0, x: -20 },
              visible: {
                opacity: 1,
                x: 0,
                transition: { duration: 0.4, ease: "easeOut" },
              },
            }}
          >
            <CheckCircle
              className={cn(
                "h-6 w-6 shrink-0",
                variant === "default" ? "text-primary" : "",
              )}
            />
            <p>{benefit}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
