import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

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
          <Image
            src="/hoador-logo.svg"
            alt="Hoador"
            width={120}
            height={40}
            className="h-10 w-auto"
          />
        </Link>
        {children}
      </div>
    </div>
  );
}
