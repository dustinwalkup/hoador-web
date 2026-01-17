import { cn } from "@/lib/utils";
import Link from "next/link";
import { Logo } from "@/components/logo";

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
        <Link href="/" className="mb-8 flex justify-center">
          <Logo
            width={120}
            height={40}
            absolutePosition="-right-14!"
            className="h-10 w-auto"
            showBetaTag
          />
        </Link>
        {children}
      </div>
    </div>
  );
}
