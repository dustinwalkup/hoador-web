"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

import { META_PIXEL_ID, trackPageView } from "@/lib/analytics/meta";

/**
 * Global Meta Pixel installer.
 *
 * - Injects the base pixel once via `next/script` (afterInteractive).
 * - Initializes the pixel and fires the initial PageView on first paint.
 * - Fires PageView on App Router client navigations. Keyed on pathname only:
 *   query-string changes (explore filters, sort, search) are not page views
 *   and would inflate the count.
 *
 * Renders nothing when `NEXT_PUBLIC_META_PIXEL_ID` is not configured, so
 * preview / local environments stay quiet.
 */
export function MetaPixel(): React.ReactNode {
  const pathname = usePathname();
  // Initial PageView is fired by the inline init script, so seed the ref with
  // the entry pathname. Comparing paths (instead of a first-run flag) also
  // keeps StrictMode's doubled effect run from double-counting in dev.
  const lastTrackedPath = useRef(pathname);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (pathname === lastTrackedPath.current) return;
    lastTrackedPath.current = pathname;
    trackPageView();
  }, [pathname]);

  if (!META_PIXEL_ID) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
          `.trim(),
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
