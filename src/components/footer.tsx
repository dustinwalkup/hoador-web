import Link from "next/link";
import Image from "next/image";

const COPYRIGHT = `© ${new Date().getFullYear()} Hoador, Inc. All rights reserved`;

const FOOTER_SECTIONS = [
  {
    title: "About",
    links: [
      { label: "How ToolShare works", href: "/how-it-works" },
      { label: "Trust & Safety", href: "/trust-safety" },
      { label: "Careers", href: "/careers" },
      { label: "About us", href: "/about" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Invite Neighbors", href: "/invite" },
      { label: "Request HOA", href: "/request-hoa" },
      { label: "Gift cards", href: "/gift-cards" },
      { label: "Community Guidelines", href: "/community-guidelines" },
    ],
  },
  {
    title: "List",
    links: [
      { label: "List your tools", href: "/list-tools" },
      { label: "Host an online experience", href: "/host-experience" },
      { label: "Resource Center", href: "/resource-center" },
      { label: "Your HOA", href: "/your-hoa" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/help-center" },
      { label: "HOA support", href: "/hoa-support" },
      { label: "Contact us", href: "/contact" },
      { label: "FAQs", href: "/faq" },
    ],
  },
] as const;

const BOTTOM_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Sitemap", href: "/sitemap" },
] as const;

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://facebook.com", src: "/svg/facebook.svg" },
  { label: "X", href: "https://twitter.com", src: "/svg/x.svg" },
  {
    label: "Instagram",
    href: "https://instagram.com",
    src: "/svg/instagram.svg",
  },
  { label: "YouTube", href: "https://youtube.com", src: "/svg/youtube.svg" },
] as const;

export default function Footer() {
  return (
    <footer className="bg-muted/40 border-t">
      <div className="mobile-padding container mx-auto py-12">
        {/* Top grid of sections */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {FOOTER_SECTIONS.map(({ title, links }) => (
            <div key={title}>
              <h3 className="mb-4 text-lg font-semibold">{title}</h3>
              <ul className="space-y-3">
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t pt-8 md:flex-row">
          {/* Logo + copyright */}
          <div className="flex items-center gap-4">
            <Image
              src="/hoador-logo.svg"
              alt="ToolShare"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
            <p className="text-muted-foreground text-sm">{COPYRIGHT}</p>
          </div>

          {/* Links + social icons */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              {BOTTOM_LINKS.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-4">
              {SOCIAL_LINKS.map(({ label, href, src }) => (
                <Link
                  key={label}
                  href={href}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <span className="sr-only">{label}</span>
                  <Image src={src} alt={label} width={24} height={24} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
