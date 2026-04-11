"use client";

import { signOut } from "@/features/auth/utils";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut("/")}
      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
    >
      Log out
    </button>
  );
}
