import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface FooterLinkProps {
  href: string;
  children: React.ReactNode;
  isExternal?: boolean;
}

export function FooterLink({
  href,
  children,
  isExternal = false,
}: FooterLinkProps) {
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground inline-flex items-start gap-1 text-sm transition-colors"
      >
        {children}
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
    >
      {children}
    </Link>
  );
}

interface FooterSectionProps {
  title: string;
  children: React.ReactNode;
}

export function FooterSection({ title, children }: FooterSectionProps) {
  return (
    <div className="flex flex-col items-start space-y-3 md:items-center">
      <div className="flex flex-col items-start gap-2">
        <h3 className="text-foreground text-sm font-semibold">{title}</h3>
        <ul className="space-y-2">{children}</ul>
      </div>
    </div>
  );
}
