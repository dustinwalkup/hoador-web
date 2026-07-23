import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep these out of the bundle so they load from node_modules at runtime and
  // their native deps get traced. `sharp` MUST be external: when Turbopack
  // bundles it, output-file-tracing can't follow sharp's require() to the
  // libvips `.so`, so the Linux function ships without libvips-cpp and every
  // route in sharp's import graph (all of /api/listings/**) crashes with a
  // dlopen failure that Next renders as a generic 500 HTML page.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "sharp"],
  outputFileTracingIncludes: {
    "/api/internal/generate-rental-agreement": [
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
    "/api/internal/generate-service-agreement": [
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
    // Belt-and-suspenders: force the Linux libvips native libs into every
    // function that imports sharp, in case tracing still misses the dlopen.
    "/api/listings/**": [
      "./node_modules/@img/sharp-linux-x64/**",
      "./node_modules/@img/sharp-libvips-linux-x64/**",
    ],
    "/api/profile/upload": [
      "./node_modules/@img/sharp-linux-x64/**",
      "./node_modules/@img/sharp-libvips-linux-x64/**",
    ],
    "/api/disputes/**": [
      "./node_modules/@img/sharp-linux-x64/**",
      "./node_modules/@img/sharp-libvips-linux-x64/**",
    ],
  },
  images: {
    remotePatterns: [
      // Vercel Blob
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "hvom5mpictiugrk9.public.blob.vercel-storage.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "thnd3cwzf3mlmu4a.public.blob.vercel-storage.com",
        port: "",
        pathname: "/**",
      },
      // Google Profile Images
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // Security: Content Security Policy for PWA
  async headers() {
    return [
      {
        source: "/site.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
      {
        // Apple/iOS fetch the AASA over their CDN and expect JSON. The file has
        // no extension, so pin the content type rather than relying on Vercel's
        // default. Universal links (P3) associate www.hoador.com (prod) and
        // staging.hoador.com (staging) with the app; the apex hoador.com cannot
        // serve this (it 307-redirects to www).
        source: "/.well-known/apple-app-site-association",
        headers: [
          {
            key: "Content-Type",
            value: "application/json",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://connect-js.stripe.com https://va.vercel-scripts.com https://connect.facebook.net", // Next.js requires unsafe-eval in dev, Stripe Connect, Vercel Speed Insights, Meta Pixel
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://hvom5mpictiugrk9.public.blob.vercel-storage.com https://thnd3cwzf3mlmu4a.public.blob.vercel-storage.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://picsum.photos https://www.facebook.com",
              "connect-src 'self' https://api.stripe.com https://connect-js.stripe.com https://*.sentry.io wss: https://www.facebook.com",
              "frame-src 'self' https://js.stripe.com https://connect-js.stripe.com https://hooks.stripe.com https://hvom5mpictiugrk9.public.blob.vercel-storage.com https://thnd3cwzf3mlmu4a.public.blob.vercel-storage.com", // Stripe Connect embedded components + Vercel Blob PDFs (legal policy documents rendered in <iframe>)
              "worker-src 'self' blob:", // Allow service worker
              "manifest-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "hoador",

  project: "javascript-nextjs",

  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
