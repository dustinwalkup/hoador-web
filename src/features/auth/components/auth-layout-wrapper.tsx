"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { motion } from "framer-motion";

export function AuthLayoutWrapper({
  children,
  isOnboarding = false,
}: {
  children: React.ReactNode;
  isOnboarding?: boolean;
}) {
  return (
    <div className="bg-muted/40 flex min-h-screen flex-col items-center justify-center p-4 py-12">
      <div className={cn("w-full max-w-md", isOnboarding && "max-w-3xl")}>
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
            scale: 0.95,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          transition={{
            duration: 0.6,
            delay: 0.1,
            ease: [0.25, 0.4, 0.25, 1],
          }}
        >
          <Link href="/" className="mb-8 flex justify-center">
            <Logo
              width={120}
              height={40}
              absolutePosition="-right-14!"
              style={{ height: "2.5rem", width: "auto" }}
              showBetaTag
              priority
            />
          </Link>
        </motion.div>
        {children}
      </div>
    </div>
  );
}
