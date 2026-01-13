/**
 * Service Worker for Hoador PWA
 *
 * This service worker implements offline functionality, caching strategies,
 * and cache management for the Hoador tool rental marketplace.
 */

// Cache Configuration Constants
// These match the values in src/lib/pwa/cache-config.ts
const CACHE_VERSION = "v1.0.0";
const STATIC_CACHE_NAME = `hoador-static-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `hoador-images-${CACHE_VERSION}`;
const API_CACHE_NAME = `hoador-api-${CACHE_VERSION}`;
const PAGE_CACHE_NAME = `hoador-pages-${CACHE_VERSION}`;

// Cache size limits
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_ENTRIES_PER_CACHE = 100; // Maximum number of entries per cache

// Network timeout for network-first strategy
// Optimized: Shorter timeout for faster fallback to cache
const NETWORK_TIMEOUT = 3000; // 3 seconds (reduced from 5s for better UX)
const API_TIMEOUT = 5000; // 5 seconds for API requests (longer for data)

// Critical assets to pre-cache on install
const CRITICAL_ASSETS = [
  "/",
  "/offline",
  "/site.webmanifest",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-96x96.png",
];

self.addEventListener("install", handleInstall);
self.addEventListener("activate", handleActivate);
self.addEventListener("fetch", handleFetch);
self.addEventListener("message", handleMessage);

// Error handling for unhandled errors
self.addEventListener("error", (event) => {
  console.error("Service Worker Error:", event.error);
});

self.addEventListener("unhandledrejection", (event) => {
  console.error("Service Worker Unhandled Rejection:", event.reason);
});

/**
 * Handle service worker install event
 * Pre-caches critical assets for offline functionality
 */
async function handleInstall(event) {
  console.log("[SW] Installing service worker...");

  try {
    event.waitUntil(
      (async () => {
        // Open the static cache
        const cache = await caches.open(STATIC_CACHE_NAME);

        // Pre-cache critical assets
        const cachePromises = CRITICAL_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response.clone());
              console.log(`[SW] Pre-cached: ${url}`);
            } else {
              console.warn(`[SW] Failed to cache ${url}: ${response.status}`);
            }
          } catch (error) {
            console.warn(`[SW] Failed to fetch ${url}:`, error);
          }
        });

        await Promise.allSettled(cachePromises);

        // Skip waiting to activate immediately (allows immediate activation)
        // This ensures the new service worker takes control immediately
        await self.skipWaiting();

        console.log("[SW] Service worker installed and activated");
      })(),
    );
  } catch (error) {
    console.error("[SW] Install error:", error);
    // Don't fail installation on cache errors - continue anyway
  }
}

/**
 * Handle service worker activate event
 * Cleans up old cache versions and takes control of clients
 */
async function handleActivate(event) {
  console.log("[SW] Activating service worker...");

  try {
    event.waitUntil(
      (async () => {
        // Get all cache names
        const cacheNames = await caches.keys();

        // Delete caches that don't match current version
        const deletePromises = cacheNames
          .filter((cacheName) => {
            // Delete caches that start with "hoador-" but don't include current version
            return (
              cacheName.startsWith("hoador-") &&
              !cacheName.includes(CACHE_VERSION)
            );
          })
          .map(async (cacheName) => {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          });

        await Promise.all(deletePromises);

        // Clean up expired entries from all caches
        await cleanupExpiredEntries();

        // Take control of all clients immediately
        await self.clients.claim();

        console.log("[SW] Service worker activated and controlling clients");
      })(),
    );
  } catch (error) {
    console.error("[SW] Activate error:", error);
  }
}

/**
 * Cache-first strategy: Check cache first, fallback to network
 * Best for: Static assets (CSS, JS, fonts, images)
 *
 * @param {Request} request - The request to handle
 * @param {string} cacheName - Name of the cache to use
 * @returns {Promise<Response>} - Cached or network response
 */
async function cacheFirst(request, cacheName) {
  try {
    // Check cache first
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log(`[SW] Cache hit: ${request.url}`);
      return cachedResponse;
    }

    // Not in cache, fetch from network
    console.log(`[SW] Cache miss, fetching: ${request.url}`);
    const networkResponse = await fetch(request);

    // Only cache successful responses
    if (networkResponse.ok) {
      // Clone response before caching (response can only be read once)
      await cache.put(request, networkResponse.clone());

      // Check cache size and evict if needed
      await manageCacheSize(cacheName);
    }

    return networkResponse;
  } catch (error) {
    console.error(`[SW] Cache-first error for ${request.url}:`, error);

    // Return offline fallback if available
    const offlineResponse = await getOfflineFallback(request);
    if (offlineResponse) {
      return offlineResponse;
    }

    // Return network error response
    return new Response("Network error", {
      status: 408,
      statusText: "Request Timeout",
    });
  }
}

/**
 * Network-first strategy: Try network first, fallback to cache
 * Best for: API requests, HTML pages
 *
 * @param {Request} request - The request to handle
 * @param {string} cacheName - Name of the cache to use
 * @param {number} timeout - Network timeout in milliseconds
 * @returns {Promise<Response>} - Network or cached response
 */
async function networkFirst(request, cacheName, timeout = NETWORK_TIMEOUT) {
  try {
    const cache = await caches.open(cacheName);

    // Try network request with timeout
    const networkPromise = fetch(request);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Network timeout")), timeout),
    );

    let networkResponse;
    try {
      networkResponse = await Promise.race([networkPromise, timeoutPromise]);

      // Network succeeded, update cache and return response
      if (networkResponse.ok) {
        await cache.put(request, networkResponse.clone());
        await manageCacheSize(cacheName);
        console.log(`[SW] Network success: ${request.url}`);
        return networkResponse;
      }
    } catch {
      console.log(`[SW] Network failed, checking cache: ${request.url}`);
      // Network failed or timed out, continue to cache check
    }

    // Network failed, check cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log(`[SW] Serving from cache: ${request.url}`);
      return cachedResponse;
    }

    // No cache either, return offline fallback
    const offlineResponse = await getOfflineFallback(request);
    if (offlineResponse) {
      return offlineResponse;
    }

    // Return network error response
    return new Response("Offline and not cached", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error(`[SW] Network-first error for ${request.url}:`, error);

    // Try offline fallback
    const offlineResponse = await getOfflineFallback(request);
    if (offlineResponse) {
      return offlineResponse;
    }

    return new Response("Network error", {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
}

/**
 * Stale-while-revalidate strategy: Return cached immediately, update in background
 * Best for: Assets that can be slightly stale (images, fonts)
 *
 * @param {Request} request - The request to handle
 * @param {string} cacheName - Name of the cache to use
 * @returns {Promise<Response>} - Cached response immediately, updates cache in background
 */
async function staleWhileRevalidate(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);

    // Check cache first
    const cachedResponse = await cache.match(request);

    // Fetch from network in background (don't await)
    const networkPromise = fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          // Update cache with fresh response in background
          cache
            .put(request, networkResponse.clone())
            .then(() => manageCacheSize(cacheName))
            .catch((error) => {
              console.warn(
                `[SW] Background cache update failed: ${request.url}`,
                error,
              );
            });
          console.log(`[SW] Cache updated in background: ${request.url}`);
        }
        return networkResponse;
      })
      .catch((error) => {
        console.warn(`[SW] Background fetch failed: ${request.url}`, error);
        return null;
      });

    // If we have a cached response, return it immediately
    if (cachedResponse) {
      console.log(`[SW] Serving stale, revalidating: ${request.url}`);
      // Don't await networkPromise - return cached immediately
      networkPromise.catch(() => {}); // Suppress unhandled rejection
      return cachedResponse;
    }

    // No cache, wait for network
    console.log(`[SW] No cache, fetching: ${request.url}`);
    const networkResponse = await networkPromise;

    if (networkResponse) {
      return networkResponse;
    }

    // Network failed, try offline fallback
    const offlineResponse = await getOfflineFallback(request);
    if (offlineResponse) {
      return offlineResponse;
    }

    return new Response("Network error", {
      status: 408,
      statusText: "Request Timeout",
    });
  } catch (error) {
    console.error(`[SW] Stale-while-revalidate error: ${request.url}`, error);

    const offlineResponse = await getOfflineFallback(request);
    if (offlineResponse) {
      return offlineResponse;
    }

    return new Response("Network error", {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
}

/**
 * Check if a request contains sensitive data that should not be cached
 *
 * @param {URL} url - The request URL
 * @param {Request} request - The request object
 * @returns {boolean} Whether the request is sensitive
 */
function isSensitiveRequest(url, request) {
  // Never cache authentication endpoints
  if (
    url.pathname.startsWith("/api/auth/") ||
    url.pathname.startsWith("/api/signin") ||
    url.pathname.startsWith("/api/signout") ||
    url.pathname.startsWith("/api/signup")
  ) {
    return true;
  }

  // Never cache user profile or account endpoints (may contain sensitive data)
  if (
    url.pathname.startsWith("/api/profile") ||
    url.pathname.startsWith("/api/user") ||
    url.pathname.startsWith("/api/account")
  ) {
    return true;
  }

  // Never cache payment-related endpoints
  if (
    url.pathname.includes("/payment") ||
    url.pathname.includes("/stripe") ||
    url.pathname.includes("/setup-intent") ||
    url.pathname.includes("/checkout")
  ) {
    return true;
  }

  // Never cache requests with authorization headers (may contain tokens)
  if (request.headers.get("authorization")) {
    return true;
  }

  // Never cache requests with sensitive query parameters
  const sensitiveParams = ["token", "key", "secret", "password", "auth"];
  for (const param of sensitiveParams) {
    if (url.searchParams.has(param)) {
      return true;
    }
  }

  return false;
}

/**
 * Handle fetch events and route requests to appropriate caching strategies
 */
function handleFetch(event) {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  // Only handle same-origin requests (skip cross-origin)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip service worker and manifest requests
  if (url.pathname === "/sw.js" || url.pathname === "/site.webmanifest") {
    return;
  }

  // Security: Never cache sensitive requests
  if (isSensitiveRequest(url, request)) {
    console.log(`[SW] Skipping cache for sensitive request: ${url.pathname}`);
    // Fetch from network only, don't cache
    // Call respondWith immediately with a Promise
    event.respondWith(
      fetch(request).catch((error) => {
        console.error(
          `[SW] Failed to fetch sensitive request: ${url.pathname}`,
          error,
        );
        return new Response("Network error", {
          status: 503,
          statusText: "Service Unavailable",
        });
      }),
    );
    return;
  }

  // Call respondWith immediately with a Promise to avoid InvalidStateError
  // The Promise will resolve with the appropriate response
  event.respondWith(
    (async () => {
      try {
        let response;

        // Route requests by URL pattern
        if (isStaticAsset(url)) {
          // Static assets: CSS, JS, fonts, etc. → cache-first
          response = await cacheFirst(request, STATIC_CACHE_NAME);
        } else if (isImage(url)) {
          // Images → cache-first with stale-while-revalidate
          response = await staleWhileRevalidate(request, IMAGE_CACHE_NAME);
        } else if (isApiRequest(url)) {
          // API requests → network-first with longer timeout
          response = await networkFirst(request, API_CACHE_NAME, API_TIMEOUT);
        } else if (isPageRequest(url)) {
          // HTML pages → network-first with cache fallback
          response = await networkFirst(request, PAGE_CACHE_NAME);
        } else {
          // Default: network-first
          response = await networkFirst(request, PAGE_CACHE_NAME);
        }

        return response;
      } catch (error) {
        console.error(`[SW] Fetch handler error for ${request.url}:`, error);

        // Try offline fallback as last resort
        const offlineResponse = await getOfflineFallback(request);
        return (
          offlineResponse ||
          new Response("Service Worker Error", {
            status: 500,
            statusText: "Internal Server Error",
          })
        );
      }
    })(),
  );
}

/**
 * Check if request is for a static asset (CSS, JS, fonts)
 */
function isStaticAsset(url) {
  return (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ttf") ||
    url.pathname.endsWith(".eot") ||
    url.pathname.startsWith("/_next/static/")
  );
}

/**
 * Check if request is for an image
 */
function isImage(url) {
  return (
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".gif") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".avif") ||
    url.pathname.startsWith("/images/")
  );
}

/**
 * Check if request is for an API endpoint
 */
function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

/**
 * Check if request is for an HTML page
 */
function isPageRequest(url) {
  return (
    !url.pathname.includes(".") || // No file extension
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/")
  );
}

/**
 * Get offline fallback response for uncached requests
 * Returns offline page for HTML requests, error response for others
 *
 * @param {Request} request - The original request
 * @returns {Promise<Response|null>} - Offline fallback response or null
 */
async function getOfflineFallback(request) {
  try {
    // For HTML page requests, return offline page
    if (
      request.headers.get("accept")?.includes("text/html") ||
      isPageRequest(new URL(request.url))
    ) {
      const offlineCache = await caches.open(STATIC_CACHE_NAME);
      const offlinePage = await offlineCache.match("/offline");

      if (offlinePage) {
        console.log("[SW] Serving offline page");
        return offlinePage;
      }
    }

    // For other requests, return null (caller will handle)
    return null;
  } catch (error) {
    console.error("[SW] Error getting offline fallback:", error);
    return null;
  }
}

/**
 * Manage cache size by implementing LRU (Least Recently Used) eviction
 * Evicts oldest entries when cache exceeds size or entry limits
 *
 * @param {string} cacheName - Name of the cache to manage
 * @returns {Promise<void>}
 */
async function manageCacheSize(cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    // Check if we exceed entry limit
    if (keys.length <= MAX_ENTRIES_PER_CACHE) {
      // Check total cache size
      let totalSize = 0;
      const entries = [];

      for (const key of keys) {
        const response = await cache.match(key);
        if (response) {
          const clonedResponse = response.clone();
          const body = await clonedResponse.blob();
          const size = body.size;
          const lastModified =
            response.headers.get("date") || new Date().toISOString();

          totalSize += size;
          entries.push({
            key,
            size,
            lastModified: new Date(lastModified).getTime(),
          });
        }
      }

      // If within size limit, no eviction needed
      if (totalSize <= MAX_CACHE_SIZE) {
        return;
      }

      // Sort by last modified (oldest first) for LRU eviction
      entries.sort((a, b) => a.lastModified - b.lastModified);
    } else {
      // Exceeded entry limit, sort all entries by last modified
      const entries = [];
      for (const key of keys) {
        const response = await cache.match(key);
        if (response) {
          const lastModified =
            response.headers.get("date") || new Date().toISOString();
          entries.push({
            key,
            lastModified: new Date(lastModified).getTime(),
          });
        }
      }
      entries.sort((a, b) => a.lastModified - b.lastModified);

      // Delete oldest entries until under limit
      const toDelete = entries.slice(0, entries.length - MAX_ENTRIES_PER_CACHE);
      await Promise.all(toDelete.map((entry) => cache.delete(entry.key)));

      console.log(
        `[SW] Evicted ${toDelete.length} entries from ${cacheName} (entry limit)`,
      );
      return;
    }

    // Evict oldest entries until under size limit
    let currentSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const toDelete = [];

    for (const entry of entries) {
      if (currentSize <= MAX_CACHE_SIZE) {
        break;
      }
      toDelete.push(entry);
      currentSize -= entry.size;
    }

    if (toDelete.length > 0) {
      await Promise.all(toDelete.map((entry) => cache.delete(entry.key)));
      console.log(
        `[SW] Evicted ${toDelete.length} entries from ${cacheName} (size limit: ${Math.round(currentSize / 1024 / 1024)}MB)`,
      );
    }
  } catch (error) {
    console.error(`[SW] Error managing cache size for ${cacheName}:`, error);
  }
}

/**
 * Clean up expired cache entries based on MAX_CACHE_AGE
 * This is called periodically or on activation
 */
async function cleanupExpiredEntries() {
  try {
    const cacheNames = [
      STATIC_CACHE_NAME,
      IMAGE_CACHE_NAME,
      API_CACHE_NAME,
      PAGE_CACHE_NAME,
    ];

    const now = Date.now();

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();

      for (const key of keys) {
        const response = await cache.match(key);
        if (response) {
          const dateHeader = response.headers.get("date");
          if (dateHeader) {
            const entryAge = now - new Date(dateHeader).getTime();
            if (entryAge > MAX_CACHE_AGE) {
              await cache.delete(key);
              console.log(`[SW] Deleted expired entry: ${key.url}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("[SW] Error cleaning up expired entries:", error);
  }
}

/**
 * Handle messages from client pages
 * Can be used for cache invalidation, status updates, etc.
 */
async function handleMessage(event) {
  console.log("[SW] Message received:", event.data);

  if (!event.data) {
    return;
  }

  const { type } = event.data;

  switch (type) {
    case "SKIP_WAITING":
      // Client requests immediate activation
      await self.skipWaiting();
      await self.clients.claim();
      break;

    case "CLEAR_CACHE":
      // Client requests cache clearing
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log("[SW] All caches cleared");
      break;

    case "CLEANUP_EXPIRED":
      // Client requests expired entry cleanup
      await cleanupExpiredEntries();
      break;

    default:
      console.log(`[SW] Unknown message type: ${type}`);
  }
}

// Note: Expired entry cleanup is called in handleActivate function
