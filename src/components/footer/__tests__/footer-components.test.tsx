import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FooterLink, FooterSection } from "../footer-components";

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ExternalLink: () => <span data-testid="external-link-icon" />,
}));

describe("FooterLink", () => {
  describe("Internal Links", () => {
    it("should render internal link with Next.js Link component", () => {
      render(<FooterLink href="/help">Help Center</FooterLink>);

      const link = screen.getByText("Help Center");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", "/help");
    });

    it("should not have external link attributes for internal links", () => {
      render(<FooterLink href="/help">Help Center</FooterLink>);

      const link = screen.getByText("Help Center").closest("a");
      expect(link).not.toHaveAttribute("target", "_blank");
      expect(link).not.toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should apply correct styling classes", () => {
      render(<FooterLink href="/help">Help Center</FooterLink>);

      const link = screen.getByText("Help Center").closest("a");
      expect(link).toHaveClass(
        "text-muted-foreground",
        "hover:text-foreground",
        "text-sm",
        "transition-colors",
      );
    });
  });

  describe("External Links", () => {
    it("should render external link with anchor tag", () => {
      render(
        <FooterLink href="https://example.com/doc.pdf" isExternal>
          External Document
        </FooterLink>,
      );

      const link = screen.getByText("External Document");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "https://example.com/doc.pdf",
      );
    });

    it("should have external link attributes", () => {
      render(
        <FooterLink href="https://example.com/doc.pdf" isExternal>
          External Document
        </FooterLink>,
      );

      const link = screen.getByText("External Document").closest("a");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should render external link icon", () => {
      render(
        <FooterLink href="https://example.com/doc.pdf" isExternal>
          External Document
        </FooterLink>,
      );

      expect(screen.getByTestId("external-link-icon")).toBeInTheDocument();
    });

    it("should apply correct styling classes for external links", () => {
      render(
        <FooterLink href="https://example.com/doc.pdf" isExternal>
          External Document
        </FooterLink>,
      );

      const link = screen.getByText("External Document").closest("a");
      expect(link).toHaveClass(
        "text-muted-foreground",
        "hover:text-foreground",
        "inline-flex",
        "items-start",
        "gap-1",
        "text-sm",
        "transition-colors",
      );
    });
  });

  describe("Default Behavior", () => {
    it("should default to internal link when isExternal is not provided", () => {
      render(<FooterLink href="/test">Test Link</FooterLink>);

      const link = screen.getByText("Test Link").closest("a");
      expect(link).not.toHaveAttribute("target", "_blank");
      expect(
        screen.queryByTestId("external-link-icon"),
      ).not.toBeInTheDocument();
    });
  });
});

describe("FooterSection", () => {
  describe("Rendering", () => {
    it("should render section with title", () => {
      render(
        <FooterSection title="Legal">
          <li>Link 1</li>
          <li>Link 2</li>
        </FooterSection>,
      );

      expect(screen.getByText("Legal")).toBeInTheDocument();
      expect(screen.getByText("Link 1")).toBeInTheDocument();
      expect(screen.getByText("Link 2")).toBeInTheDocument();
    });

    it("should render title as heading", () => {
      render(
        <FooterSection title="Policies">
          <li>Link</li>
        </FooterSection>,
      );

      const title = screen.getByText("Policies");
      expect(title.tagName).toBe("H3");
      expect(title).toHaveClass("text-foreground", "text-sm", "font-semibold");
    });

    it("should render children in a list", () => {
      render(
        <FooterSection title="Support">
          <li>Help Center</li>
          <li>Report Issue</li>
        </FooterSection>,
      );

      const list = screen.getByText("Help Center").closest("ul");
      expect(list).toBeInTheDocument();
      expect(list).toHaveClass("space-y-2");
    });
  });

  describe("Layout and Styling", () => {
    it("should have correct container classes", () => {
      const { container } = render(
        <FooterSection title="Legal">
          <li>Link</li>
        </FooterSection>,
      );

      const sectionDiv = container.firstChild;
      expect(sectionDiv).toHaveClass(
        "flex",
        "flex-col",
        "items-start",
        "space-y-3",
        "md:items-center",
      );
    });

    it("should have correct inner container classes", () => {
      const { container } = render(
        <FooterSection title="Legal">
          <li>Link</li>
        </FooterSection>,
      );

      // Find the inner div that contains the title and list (has gap-2)
      const innerDiv = container.querySelector("h3")?.parentElement;
      expect(innerDiv).toBeInTheDocument();
      expect(innerDiv).toHaveClass("flex", "flex-col", "items-start", "gap-2");
    });
  });

  describe("Content", () => {
    it("should render multiple children", () => {
      render(
        <FooterSection title="Legal">
          <li>Terms of Service</li>
          <li>Privacy Policy</li>
          <li>Community Guidelines</li>
        </FooterSection>,
      );

      expect(screen.getByText("Terms of Service")).toBeInTheDocument();
      expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
      expect(screen.getByText("Community Guidelines")).toBeInTheDocument();
    });

    it("should render empty section when no children", () => {
      render(
        <FooterSection title="Empty Section">
          <></>
        </FooterSection>,
      );

      expect(screen.getByText("Empty Section")).toBeInTheDocument();
      const list = screen
        .getByText("Empty Section")
        .parentElement?.querySelector("ul");
      expect(list).toBeInTheDocument();
    });
  });
});
