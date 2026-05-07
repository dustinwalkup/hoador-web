import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "../logo";

// Mock Next.js Image
vi.mock("next/image", () => ({
  default: (props: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt || ""} />
  ),
}));

describe("Logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render logo image with default props", () => {
      render(<Logo />);

      const logo = screen.getByAltText("Hoador Logo");
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute("src", "/hoador-logo.svg");
      expect(logo).toHaveAttribute("width", "120");
      expect(logo).toHaveAttribute("height", "40");
    });

    it("should render logo with custom width and height", () => {
      render(<Logo width={100} height={20} />);

      const logo = screen.getByAltText("Hoador Logo");
      expect(logo).toHaveAttribute("width", "100");
      expect(logo).toHaveAttribute("height", "20");
    });

    it("should render logo with custom alt text", () => {
      render(<Logo alt="Custom Alt Text" />);

      const logo = screen.getByAltText("Custom Alt Text");
      expect(logo).toBeInTheDocument();
    });

    it("should render logo with custom className", () => {
      render(<Logo className="custom-class h-10 w-auto" />);

      const logo = screen.getByAltText("Hoador Logo");
      expect(logo).toHaveClass("custom-class", "h-10", "w-auto");
    });

    it("should set priority attribute when provided", () => {
      render(<Logo priority />);

      const logo = screen.getByAltText("Hoador Logo");
      // Next.js Image component handles priority internally
      expect(logo).toBeInTheDocument();
    });
  });

  describe("Without Beta Tag", () => {
    it("should render only logo image when showBetaTag is false", () => {
      const { container } = render(<Logo showBetaTag={false} />);

      const logo = screen.getByAltText("Hoador Logo");
      expect(logo).toBeInTheDocument();
      // No wrapper div is added when showBetaTag is false; the image is the root.
      expect(container.firstChild).toBe(logo);
    });

    it("should render only logo image when showBetaTag is not provided", () => {
      render(<Logo />);

      const logo = screen.getByAltText("Hoador Logo");
      expect(logo).toBeInTheDocument();
    });
  });

  describe("With showBetaTag - Sidebar Context", () => {
    it("should use sidebar layout for small logos", () => {
      const { container } = render(
        <Logo width={100} height={20} showBetaTag />,
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass(
        "relative",
        "flex",
        "flex-col",
        "items-center",
        "gap-2",
        "p-1.5",
      );
    });
  });

  describe("With showBetaTag - Header/Footer Context", () => {
    it("should render wrapper for larger logos (width > 120)", () => {
      render(<Logo width={177} height={36} showBetaTag />);

      const logo = screen.getByAltText("Hoador Logo");
      expect(logo).toBeInTheDocument();
      const wrapper = screen.getByAltText("Hoador Logo").parentElement;
      expect(wrapper).toHaveClass("relative", "flex", "items-center");
    });

    it("should use header/footer layout for larger logos", () => {
      const { container } = render(
        <Logo width={177} height={36} showBetaTag />,
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("relative", "flex", "items-center");
    });
  });

  describe("Edge Cases", () => {
    it("should handle width exactly 120 as sidebar context", () => {
      render(<Logo width={120} height={40} showBetaTag />);

      const wrapper = screen.getByAltText("Hoador Logo").parentElement;
      expect(wrapper).toHaveClass("flex-col");
    });

    it("should handle width 121 as header/footer context", () => {
      render(<Logo width={121} height={40} showBetaTag />);

      const wrapper = screen.getByAltText("Hoador Logo").parentElement;
      expect(wrapper).toHaveClass("items-center");
      expect(wrapper).not.toHaveClass("flex-col");
    });

    it("should handle zero width gracefully", () => {
      render(<Logo width={0} height={0} showBetaTag />);

      const logo = screen.getByAltText("Hoador Logo");
      expect(logo).toHaveAttribute("width", "0");
      expect(logo).toHaveAttribute("height", "0");
    });
  });
});
