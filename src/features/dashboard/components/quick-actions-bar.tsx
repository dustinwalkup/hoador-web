"use client";

import Link from "next/link";
import { Briefcase, MessageCircle, Plus, Search, Wrench } from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface QuickActionsBarProps {
  /** Unread message count for the Messages action badge. */
  unreadCount?: number;
}

const motionChildVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

/**
 * High-value dashboard shortcuts: list (supply), browse (demand), messages.
 * Primary CTA opens a choice between rental listing and service offering.
 */
export function QuickActionsBar({ unreadCount = 0 }: QuickActionsBarProps) {
  const showUnreadBadge = unreadCount > 0;

  return (
    <motion.nav
      className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0"
      aria-label="Quick actions"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
    >
      <motion.div variants={motionChildVariants}>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              size="default"
              className="shrink-0 gap-2 shadow-xs"
            >
              <Plus className="h-4 w-4" aria-hidden />
              List item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>What would you like to list?</DialogTitle>
              <DialogDescription>
                Share items to rent or offer a service to neighbors.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 pt-2">
              <DialogClose asChild>
                <Link
                  href="/dashboard/listings/add"
                  className={cn(
                    "bg-card flex items-center gap-3 rounded-lg border p-4 text-left text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:outline-none",
                  )}
                >
                  <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md">
                    <Wrench
                      className="text-muted-foreground h-5 w-5"
                      aria-hidden
                    />
                  </span>
                  <span>
                    <span className="block">List a rental</span>
                    <span className="text-muted-foreground font-normal">
                      Items neighbors can borrow
                    </span>
                  </span>
                </Link>
              </DialogClose>
              <DialogClose asChild>
                <Link
                  href="/dashboard/services/listings/create"
                  className={cn(
                    "bg-card flex items-center gap-3 rounded-lg border p-4 text-left text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:outline-none",
                  )}
                >
                  <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md">
                    <Briefcase
                      className="text-muted-foreground h-5 w-5"
                      aria-hidden
                    />
                  </span>
                  <span>
                    <span className="block">Offer a service</span>
                    <span className="text-muted-foreground font-normal">
                      Skills and services you provide
                    </span>
                  </span>
                </Link>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      <motion.div variants={motionChildVariants}>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="default"
              className="shrink-0 gap-2"
            >
              <Search className="h-4 w-4" aria-hidden />
              Browse
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <p className="text-muted-foreground px-2 pb-2 text-xs font-medium tracking-wide uppercase">
              Browse
            </p>
            <div className="flex flex-col gap-1">
              <Link
                href="/dashboard/explore"
                className={cn(
                  "rounded-md px-2 py-2.5 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:outline-none",
                )}
              >
                <span className="font-medium">Browse rentals</span>
                <span className="text-muted-foreground block text-xs font-normal">
                  Tools and listings near you
                </span>
              </Link>
              <Link
                href="/dashboard/services"
                className={cn(
                  "rounded-md px-2 py-2.5 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:outline-none",
                )}
              >
                <span className="font-medium">Browse services</span>
                <span className="text-muted-foreground block text-xs font-normal">
                  Services from your community
                </span>
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>

      <motion.div variants={motionChildVariants}>
        <Button
          variant="outline"
          size="default"
          className="relative shrink-0 gap-2"
          asChild
        >
          <Link href="/dashboard/mailbox">
            <MessageCircle className="h-4 w-4" aria-hidden />
            Messages
            {showUnreadBadge && (
              <Badge
                variant="default"
                className="ml-0.5 min-w-5 justify-center px-1.5 py-0 text-[10px] leading-none"
                aria-label={`${unreadCount} unread messages`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Link>
        </Button>
      </motion.div>
    </motion.nav>
  );
}
