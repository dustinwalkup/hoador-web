import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React, { type RefObject } from "react";
import {
  PageHeaderProvider,
  usePageHeaderContext,
} from "../page-header-context";

describe("PageHeaderContext", () => {
  describe("PageHeaderProvider", () => {
    it("should initialize with null ref and title", () => {
      // Arrange & Act
      const { result } = renderHook(() => usePageHeaderContext(), {
        wrapper: ({ children }) => (
          <PageHeaderProvider>{children}</PageHeaderProvider>
        ),
      });

      // Assert
      expect(result.current).toBeTruthy();
      expect(result.current?.ref).toBeNull();
      expect(result.current?.title).toBeNull();
      expect(result.current?.setPageHeader).toBeDefined();
      expect(typeof result.current?.setPageHeader).toBe("function");
    });

    it("should update ref and title when setPageHeader is called", () => {
      // Arrange
      const { result } = renderHook(() => usePageHeaderContext(), {
        wrapper: ({ children }) => (
          <PageHeaderProvider>{children}</PageHeaderProvider>
        ),
      });

      const testRef = {
        current: document.createElement("div"),
      } as RefObject<HTMLElement>;

      // Act
      act(() => {
        result.current?.setPageHeader(testRef, "Test Title");
      });

      // Assert
      expect(result.current?.title).toBe("Test Title");
      expect(result.current?.ref).toBe(testRef);
    });

    it("should allow unsetting ref and title by passing null", () => {
      // Arrange
      const { result } = renderHook(() => usePageHeaderContext(), {
        wrapper: ({ children }) => (
          <PageHeaderProvider>{children}</PageHeaderProvider>
        ),
      });

      const testRef = {
        current: document.createElement("div"),
      } as RefObject<HTMLElement>;

      // Act - set then unset
      act(() => {
        result.current?.setPageHeader(testRef, "Title");
      });

      expect(result.current?.title).toBe("Title");

      act(() => {
        result.current?.setPageHeader(null, null);
      });

      // Assert
      expect(result.current?.title).toBeNull();
      expect(result.current?.ref).toBeNull();
    });

    it("should update title when setPageHeader is called with new title", () => {
      // Arrange
      const { result } = renderHook(() => usePageHeaderContext(), {
        wrapper: ({ children }) => (
          <PageHeaderProvider>{children}</PageHeaderProvider>
        ),
      });

      const testRef = {
        current: document.createElement("div"),
      } as RefObject<HTMLElement>;

      // Act
      act(() => {
        result.current?.setPageHeader(testRef, "First Title");
      });

      expect(result.current?.title).toBe("First Title");

      act(() => {
        result.current?.setPageHeader(testRef, "Updated Title");
      });

      // Assert
      expect(result.current?.title).toBe("Updated Title");
      expect(result.current?.ref).toBe(testRef);
    });
  });

  describe("usePageHeaderContext", () => {
    it("should return null when used outside PageHeaderProvider", () => {
      // Arrange & Act
      const { result } = renderHook(() => usePageHeaderContext());

      // Assert
      expect(result.current).toBeNull();
    });

    it("should return context value when used inside PageHeaderProvider", () => {
      // Arrange & Act
      const { result } = renderHook(() => usePageHeaderContext(), {
        wrapper: ({ children }) => (
          <PageHeaderProvider>{children}</PageHeaderProvider>
        ),
      });

      // Assert
      expect(result.current).toBeTruthy();
      expect(result.current?.ref).toBeDefined();
      expect(result.current?.title).toBeDefined();
      expect(result.current?.setPageHeader).toBeDefined();
    });
  });
});
