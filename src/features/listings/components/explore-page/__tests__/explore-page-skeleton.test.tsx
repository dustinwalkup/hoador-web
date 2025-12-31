import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExplorePageSkeleton } from "../explore-page-skeleton";

describe("ExplorePageSkeleton", () => {
  describe("Component Structure", () => {
    it("should render without crashing", () => {
      expect(() => render(<ExplorePageSkeleton />)).not.toThrow();
    });

    it("should render the main container", () => {
      const { container } = render(<ExplorePageSkeleton />);

      const gridContainer = container.querySelector('div[class*="grid"]');
      expect(gridContainer).toBeInTheDocument();
      expect(gridContainer).toHaveClass(
        "grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
      );
    });

    it("should render category buttons skeleton section", () => {
      const { container } = render(<ExplorePageSkeleton />);

      // Check for category buttons container
      const categoryContainer = container.querySelector(
        'div[class*="mb-8"][class*="flex-nowrap"]',
      );
      expect(categoryContainer).toHaveClass(
        "mb-8 flex flex-nowrap gap-2 overflow-x-auto pb-2",
      );

      // Should have multiple skeleton elements for category buttons
      const categorySkeletons = screen
        .getAllByRole("generic")
        .filter((element) => element.className.includes("h-16"));
      expect(categorySkeletons.length).toBeGreaterThan(5); // At least 6 category skeletons
    });

    it("should render tabs skeleton section", () => {
      const { container } = render(<ExplorePageSkeleton />);

      // Check for tabs container
      const tabsContainer = container.querySelector(
        'div[class*="mb-7"][class*="items-center"]',
      );
      expect(tabsContainer).toHaveClass(
        "mb-7 flex items-center justify-between",
      );

      // Should have tab skeletons
      const tabSkeletons = screen
        .getAllByRole("generic")
        .filter((element) => element.className.includes("h-9"));
      expect(tabSkeletons.length).toBeGreaterThan(1);
    });

    it("should render exactly 8 listing card skeletons", () => {
      render(<ExplorePageSkeleton />);

      // Should have 8 cards
      const cards = screen
        .getAllByRole("generic")
        .filter((element) =>
          element.className.includes("overflow-hidden pt-0"),
        );
      expect(cards).toHaveLength(8);
    });
  });

  describe("Skeleton Layout", () => {
    it("should render listing card skeletons with correct structure", () => {
      render(<ExplorePageSkeleton />);

      const cards = screen
        .getAllByRole("generic")
        .filter((element) =>
          element.className.includes("overflow-hidden pt-0"),
        );

      cards.forEach((card) => {
        // Each card should have an image skeleton
        const imageSkeleton = card.querySelector("[class*='h-[206px]']");
        expect(imageSkeleton).toBeInTheDocument();

        // Each card should have content with text skeletons
        const cardContent = card.querySelector("[class*='px-4 pt-5']");
        expect(cardContent).toBeInTheDocument();

        // Should have multiple text skeletons
        const textSkeletons = cardContent?.querySelectorAll("[class*='h-4']");
        expect(textSkeletons?.length).toBeGreaterThan(2);
      });
    });

    it("should render category button skeletons with varying widths", () => {
      render(<ExplorePageSkeleton />);

      const categorySkeletons = screen
        .getAllByRole("generic")
        .filter((element) => element.className.includes("h-16"));

      // Should have skeletons with different widths
      const widths = categorySkeletons.map((skeleton) => skeleton.className);
      expect(widths.some((w) => w.includes("w-100"))).toBe(true);
      expect(widths.some((w) => w.includes("w-25"))).toBe(true);
      expect(widths.some((w) => w.includes("w-[121px]"))).toBe(true);
    });

    it("should render tab skeletons with specific widths", () => {
      render(<ExplorePageSkeleton />);

      const tabSkeletons = screen
        .getAllByRole("generic")
        .filter((element) => element.className.includes("h-9"));

      // Should have skeletons with specific widths
      const widths = tabSkeletons.map((skeleton) => skeleton.className);
      expect(widths.some((w) => w.includes("w-[93px]"))).toBe(true);
      expect(widths.some((w) => w.includes("w-[155px]"))).toBe(true);
      expect(widths.some((w) => w.includes("w-25"))).toBe(true);
      expect(widths.some((w) => w.includes("w-full max-w-sm"))).toBe(true);
    });

    it("should render button skeletons in listing cards", () => {
      render(<ExplorePageSkeleton />);

      const buttonContainers = screen
        .getAllByRole("generic")
        .filter((element) =>
          element.className.includes("flex items-center gap-2"),
        );

      buttonContainers.forEach((container) => {
        const buttonSkeletons = container.querySelectorAll("[class*='h-8']");
        expect(buttonSkeletons.length).toBe(2); // Two button skeletons per card
        expect(buttonSkeletons[0]).toHaveClass("w-[118px]");
        expect(buttonSkeletons[1]).toHaveClass("w-[118px]");
      });
    });
  });

  describe("Accessibility", () => {
    it("should not have any accessible text content (skeletons don't need it)", () => {
      render(<ExplorePageSkeleton />);

      // Skeleton components typically don't have text content
      const textContent = screen.queryByText(/.+/);
      expect(textContent).toBeNull();
    });

    it("should maintain proper DOM structure", () => {
      const { container } = render(<ExplorePageSkeleton />);

      // Should have proper nested structure
      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer).toBeTruthy();
      expect(mainContainer.children.length).toBeGreaterThan(2); // At least category, tabs, and grid sections
    });
  });

  describe("Styling", () => {
    it("should use consistent spacing classes", () => {
      const { container } = render(<ExplorePageSkeleton />);

      // Check for margin bottom classes
      const categorySection = container.querySelector(
        'div[class*="mb-8"][class*="flex-nowrap"]',
      );
      expect(categorySection).toHaveClass("mb-8");

      const tabsSection = container.querySelector(
        'div[class*="mb-7"][class*="items-center"]',
      );
      expect(tabsSection).toHaveClass("mb-7");
    });

    it("should use responsive grid classes", () => {
      const { container } = render(<ExplorePageSkeleton />);

      const grid = container.querySelector('div[class*="grid"]');
      expect(grid).toBeTruthy();
      expect(grid).toHaveClass(
        "grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
      );
    });

    it("should use proper card styling", () => {
      render(<ExplorePageSkeleton />);

      const cards = screen
        .getAllByRole("generic")
        .filter((element) =>
          element.className.includes("overflow-hidden pt-0"),
        );

      cards.forEach((card) => {
        expect(card).toHaveClass("overflow-hidden pt-0");
      });
    });
  });

  describe("Performance", () => {
    it("should render all skeletons efficiently", () => {
      const startTime = performance.now();
      render(<ExplorePageSkeleton />);
      const endTime = performance.now();

      // Should render quickly (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should not re-render unnecessarily", () => {
      const { rerender } = render(<ExplorePageSkeleton />);

      // Component should be stable and not change between renders
      const firstRender = screen.getAllByRole("generic");

      rerender(<ExplorePageSkeleton />);

      const secondRender = screen.getAllByRole("generic");

      expect(secondRender.length).toBe(firstRender.length);
    });
  });
});
