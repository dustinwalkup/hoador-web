/**
 * TypeScript type definitions for PWA features
 *
 * This file contains all TypeScript interfaces and types used throughout
 * the PWA implementation, including service worker state, install prompts,
 * network status, and cache configuration.
 */

/**
 * Service Worker State
 *
 * Represents the current state of the service worker registration
 * and lifecycle.
 */
export interface ServiceWorkerState {
  /** The service worker registration object, or null if not registered */
  registration: ServiceWorkerRegistration | null;
  /** Whether an update is available for the service worker */
  updateAvailable: boolean;
  /** Whether the service worker is currently installing */
  installing: boolean;
  /** Whether a new service worker is waiting to activate */
  waiting: boolean;
  /** Whether the service worker is active */
  active: boolean;
  /** Error object if registration or activation failed */
  error: Error | null;
}

/**
 * Network Status
 *
 * Represents the current network connectivity status and information.
 */
export interface NetworkStatus {
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Whether the device was offline previously (for detecting transitions) */
  wasOffline: boolean;
  /** Effective connection type (if supported by browser) */
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  /** Downlink speed in megabits per second (if supported) */
  downlink?: number;
  /** Round-trip time in milliseconds (if supported) */
  rtt?: number;
}

/**
 * Cache Configuration
 *
 * Configuration for service worker cache management.
 */
export interface CacheConfig {
  /** Cache version string for cache invalidation */
  version: string;
  /** Name of the cache for static assets */
  staticCacheName: string;
  /** Name of the cache for image assets */
  imageCacheName: string;
  /** Name of the cache for API responses */
  apiCacheName: string;
  /** Name of the cache for HTML pages */
  pageCacheName: string;
  /** Maximum cache size in bytes */
  maxCacheSize: number;
  /** Maximum cache age in milliseconds */
  maxCacheAge: number;
}

/**
 * Cache Strategy
 *
 * Defines the caching strategy to use for a particular type of request.
 */
export interface CacheStrategy {
  /** Name of the caching strategy */
  name: "cache-first" | "network-first" | "stale-while-revalidate";
  /** Name of the cache to use for this strategy */
  cacheName: string;
  /** Network request timeout in milliseconds (for network-first strategies) */
  networkTimeout?: number;
  /** Options for cache matching (e.g., ignore search params, ignore query) */
  matchOptions?: CacheQueryOptions;
}
