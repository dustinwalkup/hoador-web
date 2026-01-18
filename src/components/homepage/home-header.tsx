"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { HOME_PAGE } from "@/constants/home";

const { header } = HOME_PAGE;

export default function HomeHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0.001 }}
      style={{
        willChange: "transform, opacity",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
      className={cn(
        "mobile-padding fixed top-0 z-50 w-full border-b pt-2! transition-all duration-30",
        "supports-backdrop-filter:bg-background/40 bg-transparent backdrop-blur",
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo
            width={100}
            height={40}
            className="h-6 w-auto"
            absolutePosition="-right-14!"
            showBetaTag
            priority
          />
        </Link>
        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: 20 }}
          style={{
            willChange: "transform, opacity",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
          animate={{ opacity: 1, x: 0.001 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            {header.logIn}
          </Link>
          <Button asChild className="rounded-full">
            <Link href="/signup">{header.signUp}</Link>
          </Button>
        </motion.div>
      </div>
    </motion.header>
  );
}
