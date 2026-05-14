"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { HOME_PAGE } from "@/constants/home";

const { header } = HOME_PAGE;

export default function HomeHeader() {
  return (
    <header
      className={cn(
        "mobile-padding fixed top-0 z-50 w-full border-b pt-2! transition-all duration-30",
        "supports-backdrop-filter:bg-background/40 bg-transparent backdrop-blur",
        "animate-header-slide-in",
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo
            width={100}
            height={40}
            style={{ height: "1.5rem", width: "auto" }}
            absolutePosition="-right-14!"
            showBetaTag
            priority
          />
        </Link>
        <div className="animate-actions-slide-in flex items-center gap-4">
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            {header.logIn}
          </Link>
          <Button asChild className="rounded-full">
            <Link href="/signup">{header.signUp}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
