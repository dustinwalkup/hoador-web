/**
 * Unit tests for cache-config.ts
 */

import { describe, it, expect } from "vitest";
import {
  CACHE_VERSION,
  STATIC_CACHE_NAME,
  IMAGE_CACHE_NAME,
  API_CACHE_NAME,
  PAGE_CACHE_NAME,
  MAX_CACHE_SIZE,
  MAX_CACHE_AGE,
  cacheConfig,
  getCacheNames,
  isCurrentVersionCache,
  getCachePrefix,
} from "../cache-config";

describe("cache-config", () => {
  describe("CACHE_VERSION", () => {
    it("should be a string", () => {
      expect(typeof CACHE_VERSION).toBe("string");
    });

    it("should start with 'v'", () => {
      expect(CACHE_VERSION.startsWith("v")).toBe(true);
    });
  });

  describe("Cache name constants", () => {
    it("should include version in static cache name", () => {
      expect(STATIC_CACHE_NAME).toContain(CACHE_VERSION);
      expect(STATIC_CACHE_NAME).toContain("hoador-static");
    });

    it("should include version in image cache name", () => {
      expect(IMAGE_CACHE_NAME).toContain(CACHE_VERSION);
      expect(IMAGE_CACHE_NAME).toContain("hoador-images");
    });

    it("should include version in API cache name", () => {
      expect(API_CACHE_NAME).toContain(CACHE_VERSION);
      expect(API_CACHE_NAME).toContain("hoador-api");
    });

    it("should include version in page cache name", () => {
      expect(PAGE_CACHE_NAME).toContain(CACHE_VERSION);
      expect(PAGE_CACHE_NAME).toContain("hoador-pages");
    });
  });

  describe("Cache size and age constants", () => {
    it("should have MAX_CACHE_SIZE of 50MB", () => {
      expect(MAX_CACHE_SIZE).toBe(50 * 1024 * 1024);
    });

    it("should have MAX_CACHE_AGE of 7 days", () => {
      expect(MAX_CACHE_AGE).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe("cacheConfig object", () => {
    it("should contain all cache configuration", () => {
      expect(cacheConfig.version).toBe(CACHE_VERSION);
      expect(cacheConfig.staticCacheName).toBe(STATIC_CACHE_NAME);
      expect(cacheConfig.imageCacheName).toBe(IMAGE_CACHE_NAME);
      expect(cacheConfig.apiCacheName).toBe(API_CACHE_NAME);
      expect(cacheConfig.pageCacheName).toBe(PAGE_CACHE_NAME);
      expect(cacheConfig.maxCacheSize).toBe(MAX_CACHE_SIZE);
      expect(cacheConfig.maxCacheAge).toBe(MAX_CACHE_AGE);
    });
  });

  describe("getCacheNames", () => {
    it("should return all cache names", () => {
      const names = getCacheNames();
      expect(names).toHaveLength(4);
      expect(names).toContain(STATIC_CACHE_NAME);
      expect(names).toContain(IMAGE_CACHE_NAME);
      expect(names).toContain(API_CACHE_NAME);
      expect(names).toContain(PAGE_CACHE_NAME);
    });
  });

  describe("isCurrentVersionCache", () => {
    it("should return true for current version cache", () => {
      expect(isCurrentVersionCache(STATIC_CACHE_NAME)).toBe(true);
      expect(isCurrentVersionCache(IMAGE_CACHE_NAME)).toBe(true);
      expect(isCurrentVersionCache(API_CACHE_NAME)).toBe(true);
      expect(isCurrentVersionCache(PAGE_CACHE_NAME)).toBe(true);
    });

    it("should return false for old version cache", () => {
      expect(isCurrentVersionCache("hoador-static-v0.9.0")).toBe(false);
      expect(isCurrentVersionCache("hoador-images-v0.9.0")).toBe(false);
    });

    it("should return false for non-hoador cache", () => {
      expect(isCurrentVersionCache("other-cache")).toBe(false);
      expect(isCurrentVersionCache("static-cache")).toBe(false);
    });
  });

  describe("getCachePrefix", () => {
    it("should return correct prefix for static cache", () => {
      expect(getCachePrefix(STATIC_CACHE_NAME)).toBe("static");
    });

    it("should return correct prefix for image cache", () => {
      expect(getCachePrefix(IMAGE_CACHE_NAME)).toBe("images");
    });

    it("should return correct prefix for API cache", () => {
      expect(getCachePrefix(API_CACHE_NAME)).toBe("api");
    });

    it("should return correct prefix for page cache", () => {
      expect(getCachePrefix(PAGE_CACHE_NAME)).toBe("pages");
    });

    it("should return null for unknown cache", () => {
      expect(getCachePrefix("unknown-cache")).toBeNull();
      expect(getCachePrefix("hoador-other-v1.0.0")).toBeNull();
    });
  });
});
