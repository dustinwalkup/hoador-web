import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthLayoutWrapper } from "../auth-layout-wrapper";

// Mock Next.js Link and Image
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: (props: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt || ""} />
  ),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
      initial,
      animate,
      transition,
      ...props
    }: any) => (
      <div
        className={className}
        data-testid="animated-logo-wrapper"
        data-initial={JSON.stringify(initial)}
        data-animate={JSON.stringify(animate)}
        data-transition={JSON.stringify(transition)}
        {...props}
      >
        {children}
      </div>
    ),
  },
}));

describe("AuthLayoutWrapper", () => {
  it("should render children content", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    render(<AuthLayoutWrapper>{testContent}</AuthLayoutWrapper>);

    // Assert
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("should render Hoador logo", () => {
    // Arrange & Act
    render(
      <AuthLayoutWrapper>
        <div>Content</div>
      </AuthLayoutWrapper>,
    );

    // Assert
    const logo = screen.getByAltText("Hoador Logo");
    expect(logo).toBeInTheDocument();
    expect(logo.closest("a")).toHaveAttribute("href", "/");
  });

  it("should apply default max-width for regular auth pages", () => {
    // Arrange & Act
    const { container } = render(
      <AuthLayoutWrapper>
        <div>Content</div>
      </AuthLayoutWrapper>,
    );

    // Assert
    const wrapper = container.querySelector(".max-w-md");
    expect(wrapper).toBeInTheDocument();
  });

  it("should apply larger max-width for onboarding pages", () => {
    // Arrange & Act
    const { container } = render(
      <AuthLayoutWrapper isOnboarding={true}>
        <div>Content</div>
      </AuthLayoutWrapper>,
    );

    // Assert
    const wrapper = container.querySelector(".max-w-3xl");
    expect(wrapper).toBeInTheDocument();
    expect(container.querySelector(".max-w-md")).not.toBeInTheDocument();
  });

  it("should have proper layout structure", () => {
    // Arrange & Act
    const { container } = render(
      <AuthLayoutWrapper>
        <div>Content</div>
      </AuthLayoutWrapper>,
    );

    // Assert
    expect(container.querySelector(".min-h-screen")).toBeInTheDocument();
    expect(container.querySelector(".flex-col")).toBeInTheDocument();
    expect(container.querySelector(".items-center")).toBeInTheDocument();
    expect(container.querySelector(".justify-center")).toBeInTheDocument();
  });

  it("should animate logo with framer-motion", () => {
    // Arrange & Act
    const { container } = render(
      <AuthLayoutWrapper>
        <div>Content</div>
      </AuthLayoutWrapper>,
    );

    // Assert
    const animatedWrapper = container.querySelector(
      '[data-testid="animated-logo-wrapper"]',
    );
    expect(animatedWrapper).toBeInTheDocument();

    const initial = JSON.parse(
      animatedWrapper?.getAttribute("data-initial") || "{}",
    );
    const animate = JSON.parse(
      animatedWrapper?.getAttribute("data-animate") || "{}",
    );
    const transition = JSON.parse(
      animatedWrapper?.getAttribute("data-transition") || "{}",
    );

    expect(initial).toEqual({
      opacity: 0,
      y: 20,
      scale: 0.95,
    });
    expect(animate).toEqual({
      opacity: 1,
      y: 0,
      scale: 1,
    });
    expect(transition).toMatchObject({
      duration: 0.6,
      delay: 0.1,
      ease: [0.25, 0.4, 0.25, 1],
    });
  });
});
