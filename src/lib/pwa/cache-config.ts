/**
 * Service Worker Cache Configuration
 *
 * Configuration for service worker cache management, including cache versioning,
 * cache names, and size limits. This configuration is used by the service worker
 * to manage different cache stores for different types of content.
 */

import type { CacheConfig } from "./types";

/**
 * Cache version string for cache invalidation
 * Increment this version when you want to invalidate all existing caches
 */
export const CACHE_VERSION = "v1.0.0";

/**
 * Cache name constants with versioning
 * Each cache name includes the version to enable clean cache updates
 */
export const STATIC_CACHE_NAME = `hoador-static-${CACHE_VERSION}`;
export const IMAGE_CACHE_NAME = `hoador-images-${CACHE_VERSION}`;
export const API_CACHE_NAME = `hoador-api-${CACHE_VERSION}`;
export const PAGE_CACHE_NAME = `hoador-pages-${CACHE_VERSION}`;

/**
 * Maximum cache size in bytes (50MB)
 * When cache exceeds this limit, LRU eviction will be triggered
 */
export const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Maximum cache age in milliseconds (7 days)
 * Cached responses older than this will be considered stale
 */
export const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Cache configuration object
 * Exports all cache configuration in a single object for easy access
 */
export const cacheConfig: CacheConfig = {
  version: CACHE_VERSION,
  staticCacheName: STATIC_CACHE_NAME,
  imageCacheName: IMAGE_CACHE_NAME,
  apiCacheName: API_CACHE_NAME,
  pageCacheName: PAGE_CACHE_NAME,
  maxCacheSize: MAX_CACHE_SIZE,
  maxCacheAge: MAX_CACHE_AGE,
};

/**
 * Get all cache names for the current version
 * Useful for cache cleanup operations
 */
export function getCacheNames(): string[] {
  return [STATIC_CACHE_NAME, IMAGE_CACHE_NAME, API_CACHE_NAME, PAGE_CACHE_NAME];
}

/**
 * Check if a cache name belongs to the current version
 * Useful for identifying old caches that should be deleted
 */
export function isCurrentVersionCache(cacheName: string): boolean {
  return cacheName.startsWith("hoador-") && cacheName.includes(CACHE_VERSION);
}

/**
 * Get cache prefix from cache name
 * Useful for identifying cache type (static, image, api, page)
 */
export function getCachePrefix(cacheName: string): string | null {
  if (cacheName.startsWith("hoador-static-")) return "static";
  if (cacheName.startsWith("hoador-images-")) return "images";
  if (cacheName.startsWith("hoador-api-")) return "api";
  if (cacheName.startsWith("hoador-pages-")) return "pages";
  return null;
}
