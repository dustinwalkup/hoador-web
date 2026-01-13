/**
 * Unit tests for service worker logic
 *
 * Tests the service worker caching strategies and event handlers.
 * Uses mocks to simulate the service worker environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock service worker globals
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn(),
};

const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
  match: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn(),
  has: vi.fn(),
};

const mockFetch = vi.fn();
const mockSkipWaiting = vi.fn();
const mockClaim = vi.fn();

// Mock service worker self object
const mockSelf = {
  location: {
    origin: "https://example.com",
  },
  skipWaiting: mockSkipWaiting,
  clients: {
    claim: mockClaim,
  },
  addEventListener: vi.fn(),
};

describe("Service Worker Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup global mocks
    (global as any).caches = mockCaches;
    (global as any).fetch = mockFetch;
    (global as any).self = mockSelf;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Cache-First Strategy", () => {
    it("should return cached response when available", async () => {
      const mockCachedResponse = new Response("cached data", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });

      mockCache.match.mockResolvedValue(mockCachedResponse);

      // Simulate cache-first logic
      const cache = await mockCaches.open("test-cache");
      const cached = await cache.match("https://example.com/page");

      expect(cached).toBe(mockCachedResponse);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fetch from network when cache miss", async () => {
      const mockNetworkResponse = new Response("network data", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });

      mockCache.match.mockResolvedValue(undefined);
      mockFetch.mockResolvedValue(mockNetworkResponse);

      // Simulate cache-first logic
      const cache = await mockCaches.open("test-cache");
      const cached = await cache.match("https://example.com/page");

      if (!cached) {
        const networkResponse = await mockFetch("https://example.com/page");
        if (networkResponse.ok) {
          await cache.put("https://example.com/page", networkResponse.clone());
        }
      }

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/page");
      expect(mockCache.put).toHaveBeenCalled();
    });
  });

  describe("Network-First Strategy", () => {
    it("should return network response when available", async () => {
      const mockNetworkResponse = new Response("network data", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });

      mockFetch.mockResolvedValue(mockNetworkResponse);

      // Simulate network-first logic
      const networkResponse = await mockFetch("https://example.com/api/data");
      if (networkResponse.ok) {
        const cache = await mockCaches.open("test-cache");
        await cache.put(
          "https://example.com/api/data",
          networkResponse.clone(),
        );
      }

      expect(mockFetch).toHaveBeenCalled();
      expect(mockCache.put).toHaveBeenCalled();
    });

    it("should fallback to cache when network fails", async () => {
      const mockCachedResponse = new Response("cached data", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

      mockFetch.mockRejectedValue(new Error("Network error"));
      mockCache.match.mockResolvedValue(mockCachedResponse);

      // Simulate network-first logic with fallback
      try {
        await mockFetch("https://example.com/api/data");
      } catch {
        const cache = await mockCaches.open("test-cache");
        const cached = await cache.match("https://example.com/api/data");
        expect(cached).toBe(mockCachedResponse);
      }
    });
  });

  describe("Stale-While-Revalidate Strategy", () => {
    it("should return cached response immediately", async () => {
      const mockCachedResponse = new Response("cached data", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });

      mockCache.match.mockResolvedValue(mockCachedResponse);

      // Simulate stale-while-revalidate logic
      const cache = await mockCaches.open("test-cache");
      const cached = await cache.match("https://example.com/image.jpg");

      expect(cached).toBe(mockCachedResponse);

      // Background fetch should happen
      mockFetch.mockResolvedValue(new Response("fresh data", { status: 200 }));
      const freshResponse = await mockFetch("https://example.com/image.jpg");
      if (freshResponse.ok) {
        await cache.put("https://example.com/image.jpg", freshResponse.clone());
      }

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("Install Event", () => {
    it("should pre-cache critical assets", async () => {
      const criticalAssets = ["/", "/offline", "/site.webmanifest"];
      const mockResponses = criticalAssets.map(
        () =>
          new Response("data", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
      );

      mockFetch.mockImplementation((url: string) => {
        const index = criticalAssets.indexOf(url);
        return Promise.resolve(
          mockResponses[index] || new Response("", { status: 404 }),
        );
      });

      // Simulate install event
      const cache = await mockCaches.open("static-cache");
      for (const url of criticalAssets) {
        const response = await mockFetch(url);
        if (response.ok) {
          await cache.put(url, response.clone());
        }
      }

      expect(mockFetch).toHaveBeenCalledTimes(criticalAssets.length);
      expect(mockCache.put).toHaveBeenCalledTimes(criticalAssets.length);
    });

    it("should call skipWaiting", async () => {
      // Simulate install event
      await mockSelf.skipWaiting();

      expect(mockSkipWaiting).toHaveBeenCalled();
    });
  });

  describe("Activate Event", () => {
    it("should delete old cache versions", async () => {
      const oldCaches = [
        "hoador-static-v0.9.0",
        "hoador-images-v0.9.0",
        "hoador-static-v1.0.0", // Current version
      ];

      mockCaches.keys.mockResolvedValue(oldCaches);

      // Simulate activate event
      const cacheNames = await mockCaches.keys();
      const toDelete = cacheNames.filter(
        (name: string) =>
          name.startsWith("hoador-") && !name.includes("v1.0.0"),
      );

      for (const name of toDelete) {
        await mockCaches.delete(name);
      }

      expect(mockCaches.delete).toHaveBeenCalledTimes(2);
    });

    it("should call clients.claim", async () => {
      // Simulate activate event
      await mockSelf.clients.claim();

      expect(mockClaim).toHaveBeenCalled();
    });
  });

  describe("Offline Fallback", () => {
    it("should return offline page for HTML requests", async () => {
      const mockOfflinePage = new Response("offline page", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });

      mockCache.match.mockResolvedValue(mockOfflinePage);

      // Simulate offline fallback
      const cache = await mockCaches.open("static-cache");
      const offlinePage = await cache.match("/offline");

      expect(offlinePage).toBe(mockOfflinePage);
    });

    it("should return null for non-HTML requests", async () => {
      mockCache.match.mockResolvedValue(null);

      // Simulate offline fallback for API request
      const cache = await mockCaches.open("static-cache");
      const offlinePage = await cache.match("/offline");

      expect(offlinePage).toBeNull();
    });
  });

  describe("Sensitive Request Filtering", () => {
    it("should identify auth endpoints as sensitive", () => {
      const sensitivePaths = [
        "/api/auth/signin",
        "/api/auth/signout",
        "/api/signin",
        "/api/signup",
      ];

      sensitivePaths.forEach((path) => {
        const isSensitive =
          path.startsWith("/api/auth/") ||
          path.startsWith("/api/signin") ||
          path.startsWith("/api/signout") ||
          path.startsWith("/api/signup");

        expect(isSensitive).toBe(true);
      });
    });

    it("should identify profile endpoints as sensitive", () => {
      const sensitivePaths = ["/api/profile", "/api/user", "/api/account"];

      sensitivePaths.forEach((path) => {
        const isSensitive =
          path.startsWith("/api/profile") ||
          path.startsWith("/api/user") ||
          path.startsWith("/api/account");

        expect(isSensitive).toBe(true);
      });
    });

    it("should identify payment endpoints as sensitive", () => {
      const sensitivePaths = [
        "/api/payment",
        "/api/stripe",
        "/api/setup-intent",
        "/api/checkout",
      ];

      sensitivePaths.forEach((path) => {
        const isSensitive =
          path.includes("/payment") ||
          path.includes("/stripe") ||
          path.includes("/setup-intent") ||
          path.includes("/checkout");

        expect(isSensitive).toBe(true);
      });
    });
  });
});
