"use client";

import Link from "next/link";
import { Wrench, Search, MessageCircle, Car, User } from "lucide-react";
import { motion } from "framer-motion";

const actions = [
  {
    href: "/dashboard/listings/rentals",
    icon: Wrench,
    label: "List something",
    color:
      "bg-emerald-500/10 text-primary dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20",
  },
  {
    href: "/dashboard/explore",
    icon: Search,
    label: "Browse listings",
    color:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 border-sky-500/20",
  },
  {
    href: "/dashboard/mailbox",
    icon: MessageCircle,
    label: "Messages",
    color:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20",
  },
  {
    href: "/dashboard/rentals/outgoing/requests",
    icon: Car,
    label: "Rentals",
    color:
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border-rose-500/20",
  },
  {
    href: "/dashboard/profile",
    icon: User,
    label: "Profile",
    color:
      "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/20",
  },
];

/**
 * Quick action links for dashboard with colorful icon-led design.
 */
export function QuickActionsBar() {
  return (
    <motion.nav
      className="flex flex-wrap gap-2"
      aria-label="Quick actions"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
    >
      {actions.map((action) => (
        <motion.div
          key={action.href}
          variants={{
            hidden: { opacity: 0, y: 10, scale: 0.95 },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
            },
          }}
        >
          <Link
            href={action.href}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${action.color}`}
          >
            <action.icon className="h-4 w-4" aria-hidden />
            {action.label}
          </Link>
        </motion.div>
      ))}
    </motion.nav>
  );
}
