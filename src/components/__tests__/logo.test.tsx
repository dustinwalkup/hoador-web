import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "../logo";
import { APP_VERSION } from "@/constants/version";

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
      render(<Logo showBetaTag={false} />);

      const logo = screen.getByAltText("Hoador Logo");
      expect(logo).toBeInTheDocument();
      expect(
        screen.queryByText(`BETA v${APP_VERSION}`),
      ).not.toBeInTheDocument();
    });

    it("should render only logo image when showBetaTag is not provided", () => {
      render(<Logo />);

      const logo = screen.getByAltText("Hoador Logo");
      expect(logo).toBeInTheDocument();
      expect(
        screen.queryByText(`BETA v${APP_VERSION}`),
      ).not.toBeInTheDocument();
    });
  });

  describe("With Beta Tag - Sidebar Context", () => {
    it("should render beta tag for small logos (width <= 120)", () => {
      render(<Logo width={100} height={20} showBetaTag />);

      const logo = screen.getByAltText("Hoador Logo");
      expect(logo).toBeInTheDocument();
      expect(screen.getByText(`BETA v${APP_VERSION}`)).toBeInTheDocument();
    });

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

    it("should apply custom absolutePosition for sidebar context", () => {
      render(
        <Logo
          width={100}
          height={20}
          showBetaTag
          absolutePosition="-right-3"
        />,
      );

      const betaTag = screen.getByText(`BETA v${APP_VERSION}`);
      expect(betaTag).toHaveClass("-right-3");
    });

    it("should use default absolutePosition when not provided in sidebar context", () => {
      render(<Logo width={100} height={20} showBetaTag />);

      const betaTag = screen.getByText(`BETA v${APP_VERSION}`);
      expect(betaTag).toHaveClass("right-0!");
    });
  });

  describe("With Beta Tag - Header/Footer Context", () => {
    it("should render wrapper for larger logos (width > 120)", () => {
      render(<Logo width={177} height={36} showBetaTag />);

      const logo = screen.getByAltText("Hoador Logo");
      expect(logo).toBeInTheDocument();
      // Note: The current implementation has the beta tag content commented out in header/footer context
      // This test verifies the structure exists
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

    it("should render span element for beta tag positioning even when content is commented", () => {
      const { container } = render(
        <Logo
          width={177}
          height={36}
          showBetaTag
          absolutePosition="-right-14!"
        />,
      );

      const betaTagSpan = container.querySelector("span");
      expect(betaTagSpan).toBeInTheDocument();
      expect(betaTagSpan).toHaveClass("-right-14!");
    });
  });

  describe("Beta Tag Positioning", () => {
    it("should use right position by default", () => {
      render(<Logo width={100} height={20} showBetaTag />);

      const betaTag = screen.getByText(`BETA v${APP_VERSION}`);
      expect(betaTag).toHaveClass(
        "absolute",
        "z-50",
        "text-xs",
        "font-semibold",
      );
    });

    it("should respect betaTagPosition prop", () => {
      render(
        <Logo width={100} height={20} showBetaTag betaTagPosition="right" />,
      );

      const betaTag = screen.getByText(`BETA v${APP_VERSION}`);
      expect(betaTag).toBeInTheDocument();
    });

    it("should display correct version number in beta tag", () => {
      render(<Logo width={100} height={20} showBetaTag />);

      expect(screen.getByText(`BETA v${APP_VERSION}`)).toBeInTheDocument();
    });

    it("should apply correct styling to beta tag", () => {
      render(<Logo width={100} height={20} showBetaTag />);

      const betaTag = screen.getByText(`BETA v${APP_VERSION}`);
      expect(betaTag).toHaveClass(
        "text-muted-foreground",
        "absolute",
        "z-50",
        "text-xs",
        "font-semibold",
      );
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
