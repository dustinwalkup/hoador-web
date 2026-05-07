import Image from "next/image";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
  showBetaTag?: boolean;
  betaTagPosition?: "right" | "bottom";
  absolutePosition?: string;
  priority?: boolean;
}

export function Logo({
  width = 120,
  height = 40,
  className,
  alt = "Hoador Logo",
  showBetaTag = false,
  betaTagPosition = "right",
  priority = false,
}: LogoProps) {
  const logoImage = (
    <Image
      src="/hoador-logo.svg"
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );

  if (!showBetaTag) {
    return logoImage;
  }

  // For sidebar context (smaller logo with tag on right)
  if (width <= 120 && betaTagPosition === "right") {
    return (
      <div className="relative flex flex-col items-center gap-2 p-1.5">
        {logoImage}
      </div>
    );
  }

  // For header/footer context (larger logo with tag on right)
  return <div className="relative flex items-center">{logoImage}</div>;
}
