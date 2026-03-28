"use client";

import * as React from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

type AvatarImageState = "empty" | "loading" | "loaded" | "error";

type AvatarContextValue = {
  imageState: AvatarImageState;
  setImageState: React.Dispatch<React.SetStateAction<AvatarImageState>>;
};

const AvatarContext = React.createContext<AvatarContextValue | null>(null);

function useAvatarContext(component: string): AvatarContextValue {
  const ctx = React.useContext(AvatarContext);
  if (!ctx) {
    throw new Error(`${component} must be used within <Avatar>`);
  }
  return ctx;
}

/**
 * Normalizes avatar `src` for display (empty / whitespace-only counts as missing).
 */
function normalizeAvatarSrc(src: string | null | undefined): string | null {
  if (src == null) {
    return null;
  }
  const trimmed = typeof src === "string" ? src.trim() : String(src).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Root container for avatar image + fallback. Coordinates load/error state so
 * fallback hides when the Next.js image has loaded.
 */
function Avatar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const [imageState, setImageState] = React.useState<AvatarImageState>("empty");

  return (
    <AvatarContext.Provider value={{ imageState, setImageState }}>
      <div
        data-slot="avatar"
        className={cn(
          "relative flex size-8 shrink-0 overflow-hidden rounded-full",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </AvatarContext.Provider>
  );
}

export type AvatarImageProps = Omit<
  React.ComponentProps<typeof Image>,
  "src" | "fill" | "alt"
> & {
  src?: string | null;
  alt?: string;
  sizes?: string;
};

/**
 * Avatar image using Next.js `Image` with `fill` so requests go through the
 * image optimizer (`/_next/image`) instead of loading remote URLs directly in the browser.
 */
function AvatarImage({
  className,
  src,
  alt,
  sizes = "40px",
  onLoadingComplete,
  onError,
  ...rest
}: AvatarImageProps) {
  const { setImageState } = useAvatarContext("AvatarImage");
  const normalized = normalizeAvatarSrc(src);
  const [failed, setFailed] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!normalized) {
      setImageState("error");
      return;
    }
    setImageState("loading");
  }, [normalized, setImageState]);

  React.useEffect(() => {
    setFailed(false);
  }, [normalized]);

  React.useEffect(() => {
    return () => {
      setImageState("empty");
    };
  }, [setImageState]);

  if (!normalized || failed) {
    return null;
  }

  return (
    <Image
      data-slot="avatar-image"
      src={normalized}
      alt={alt ?? ""}
      fill
      sizes={sizes}
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className,
      )}
      onLoadingComplete={(result) => {
        setImageState("loaded");
        onLoadingComplete?.(result);
      }}
      onError={(e) => {
        setFailed(true);
        setImageState("error");
        onError?.(e);
      }}
      {...rest}
    />
  );
}

/**
 * Shown when there is no image, the image is loading, or loading failed.
 * Hidden once the Next.js image has finished loading successfully.
 */
function AvatarFallback({
  className,
  delayMs,
  children,
  ...props
}: React.ComponentProps<"span"> & { delayMs?: number }) {
  const { imageState } = useAvatarContext("AvatarFallback");
  const [canShow, setCanShow] = React.useState(delayMs === undefined);

  React.useEffect(() => {
    if (delayMs === undefined) {
      return;
    }
    const timerId = window.setTimeout(() => setCanShow(true), delayMs);
    return () => window.clearTimeout(timerId);
  }, [delayMs]);

  if (!canShow || imageState === "loaded") {
    return null;
  }

  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted absolute inset-0 flex size-full items-center justify-center rounded-full",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
