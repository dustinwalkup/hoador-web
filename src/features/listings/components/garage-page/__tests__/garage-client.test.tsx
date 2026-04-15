import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GarageClient } from "../garage-client";

// Mock Next.js navigation
const mockUseSearchParams = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

// Mock components
vi.mock("@/components/page-header", () => ({
  PageHeader: vi.fn(({ title, description, children }) => (
    <div data-testid="page-header">
      <div data-testid="page-header-title">{title}</div>
      <div data-testid="page-header-description">{description}</div>
      <div data-testid="page-header-children">{children}</div>
    </div>
  )),
}));

vi.mock("../garage-tabs-client", () => ({
  GarageTabsClient: vi.fn(({ currentTab }) => (
    <div data-testid="garage-tabs-client">
      <div data-testid="current-tab">{currentTab}</div>
    </div>
  )),
}));

vi.mock("@/components/ui/button", () => ({
  Button: vi.fn(({ children, ...props }) => (
    <button data-testid="button" {...props}>
      {children}
    </button>
  )),
}));

vi.mock("lucide-react", () => ({
  Plus: vi.fn(() => <div data-testid="plus-icon" />),
}));

vi.mock("next/link", () => ({
  default: vi.fn(({ children, href }) => (
    <a data-testid="link" href={href}>
      {children}
    </a>
  )),
}));

import { PageHeader } from "@/components/page-header";
import { GarageTabsClient } from "../garage-tabs-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

describe("GarageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("should render without crashing", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());
      expect(() => render(<GarageClient />)).not.toThrow();
    });

    it("should render container with correct classes", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      const { container } = render(<GarageClient />);

      const containerElement = container.firstChild as HTMLElement;
      expect(containerElement).toHaveClass("container pb-6");
    });

    it("should render PageHeader with correct props", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageClient />);

      expect(PageHeader).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Your rental listings",
          description: "Manage your rental listings in one place",
        }),
        undefined,
      );
    });

    it("should render PageHeader title correctly", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageClient />);

      expect(screen.getByTestId("page-header-title")).toHaveTextContent(
        "Your rental listings",
      );
    });

    it("should render PageHeader description correctly", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageClient />);

      expect(screen.getByTestId("page-header-description")).toHaveTextContent(
        "Manage your rental listings in one place",
      );
    });

    it("should render List an item button in PageHeader children", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageClient />);

      expect(screen.getByTestId("page-header-children")).toBeInTheDocument();
      expect(screen.getByTestId("link")).toHaveAttribute(
        "href",
        "/dashboard/listings/add",
      );
      expect(screen.getByTestId("button")).toHaveTextContent("List an item");
      expect(screen.getByTestId("plus-icon")).toBeInTheDocument();
    });

    it("should render GarageTabsClient with currentTab from URL", () => {
      const searchParams = new URLSearchParams("tab=inactive");
      mockUseSearchParams.mockReturnValue(searchParams);

      render(<GarageClient />);

      expect(GarageTabsClient).toHaveBeenCalledWith(
        { currentTab: "inactive" },
        undefined,
      );
    });

    it("should render GarageTabsClient with current tab value", () => {
      const searchParams = new URLSearchParams("tab=inactive");
      mockUseSearchParams.mockReturnValue(searchParams);

      render(<GarageClient />);

      expect(screen.getByTestId("current-tab")).toHaveTextContent("inactive");
    });
  });

  describe("URL Parameter Handling", () => {
    it("should default to 'active' tab when no tab parameter is present", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageClient />);

      expect(GarageTabsClient).toHaveBeenCalledWith(
        { currentTab: "active" },
        undefined,
      );
    });

    it("should use 'active' tab when tab parameter is empty", () => {
      const searchParams = new URLSearchParams("tab=");
      mockUseSearchParams.mockReturnValue(searchParams);

      render(<GarageClient />);

      expect(GarageTabsClient).toHaveBeenCalledWith(
        { currentTab: "active" },
        undefined,
      );
    });

    it("should use 'inactive' tab when tab parameter is 'inactive'", () => {
      const searchParams = new URLSearchParams("tab=inactive");
      mockUseSearchParams.mockReturnValue(searchParams);

      render(<GarageClient />);

      expect(GarageTabsClient).toHaveBeenCalledWith(
        { currentTab: "inactive" },
        undefined,
      );
    });

    it("should use 'archived' tab when tab parameter is 'archived'", () => {
      const searchParams = new URLSearchParams("tab=archived");
      mockUseSearchParams.mockReturnValue(searchParams);

      render(<GarageClient />);

      expect(GarageTabsClient).toHaveBeenCalledWith(
        { currentTab: "archived" },
        undefined,
      );
    });
  });

  describe("Button Configuration", () => {
    it("should render button with correct size and className", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageClient />);

      expect(Button).toHaveBeenCalledWith(
        expect.objectContaining({
          size: "sm",
          className: "h-9",
        }),
        undefined,
      );
    });

    it("should render link with correct href", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageClient />);

      expect(Link).toHaveBeenCalledWith(
        expect.objectContaining({
          href: "/dashboard/listings/add",
        }),
        undefined,
      );
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic HTML structure", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageClient />);

      // Should have proper heading structure
      const heading = screen.getByTestId("page-header-title");
      expect(heading.tagName).toBe("DIV"); // PageHeader renders h1

      // Should have descriptive text
      expect(screen.getByTestId("page-header-description")).toBeInTheDocument();
    });

    it("should render link with accessible text", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageClient />);

      const link = screen.getByTestId("link");
      expect(link).toBeInTheDocument();
      expect(screen.getByText("List an item")).toBeInTheDocument();
    });
  });

  describe("Integration with child components", () => {
    it("should pass currentTab to GarageTabsClient", () => {
      const searchParams = new URLSearchParams("tab=active");
      mockUseSearchParams.mockReturnValue(searchParams);

      render(<GarageClient />);

      expect(GarageTabsClient).toHaveBeenCalledWith(
        { currentTab: "active" },
        undefined,
      );
    });

    it("should render PageHeader children correctly", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageClient />);

      expect(screen.getByTestId("page-header-children")).toContainElement(
        screen.getByTestId("link"),
      );
    });
  });
});
