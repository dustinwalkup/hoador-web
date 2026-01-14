import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../page-header";
import { PageHeaderProvider } from "@/contexts/page-header-context";

describe("PageHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render title", () => {
      // Act
      render(
        <PageHeaderProvider>
          <PageHeader title="Test Page" />
        </PageHeaderProvider>,
      );

      // Assert
      expect(screen.getByText("Test Page")).toBeInTheDocument();
    });

    it("should render description when provided", () => {
      // Act
      render(
        <PageHeaderProvider>
          <PageHeader title="Test Page" description="Test description" />
        </PageHeaderProvider>,
      );

      // Assert
      expect(screen.getByText("Test Page")).toBeInTheDocument();
      expect(screen.getByText("Test description")).toBeInTheDocument();
    });

    it("should render children when provided", () => {
      // Act
      render(
        <PageHeaderProvider>
          <PageHeader title="Test Page">
            <button>Action</button>
          </PageHeader>
        </PageHeaderProvider>,
      );

      // Assert
      expect(screen.getByText("Test Page")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Action" }),
      ).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      // Act
      const { container } = render(
        <PageHeaderProvider>
          <PageHeader title="Test Page" className="custom-class" />
        </PageHeaderProvider>,
      );

      // Assert
      const headerDiv = container.querySelector(".custom-class");
      expect(headerDiv).toBeInTheDocument();
    });
  });

  describe("Context Integration", () => {
    it("should handle missing context gracefully", () => {
      // Act - render without provider (should not crash)
      expect(() => {
        render(<PageHeader title="Test" />);
      }).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("should render title as h1 element", () => {
      // Act
      render(
        <PageHeaderProvider>
          <PageHeader title="Test Page" />
        </PageHeaderProvider>,
      );

      // Assert
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("Test Page");
    });
  });
});
