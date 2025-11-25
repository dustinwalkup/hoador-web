import Image from "next/image";

const COPYRIGHT = `© ${new Date().getFullYear()} Hoador, Inc. All rights reserved`;

export default function Footer() {
  return (
    <footer className="bg-muted/40 border-t">
      <div className="mobile-padding container mx-auto flex flex-col items-center justify-center gap-4 py-8 md:flex-row md:justify-center md:gap-6">
        <Image
          src="/hoador-logo.svg"
          alt="Hoador logo"
          width={120}
          height={40}
          className="h-8 w-auto"
        />
        <p className="text-muted-foreground text-sm">{COPYRIGHT}</p>
      </div>
    </footer>
  );
}
