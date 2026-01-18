import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimatedAuthCard } from "../animated-auth-card";

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
        data-testid="animated-auth-card"
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

describe("AnimatedAuthCard", () => {
  it("should render children content", () => {
    // Arrange
    const testContent = <div>Test Card Content</div>;

    // Act
    render(<AnimatedAuthCard>{testContent}</AnimatedAuthCard>);

    // Assert
    expect(screen.getByText("Test Card Content")).toBeInTheDocument();
  });

  it("should render with default delay", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    const { container } = render(
      <AnimatedAuthCard>{testContent}</AnimatedAuthCard>,
    );

    // Assert
    const card = container.querySelector('[data-testid="animated-auth-card"]');
    expect(card).toBeInTheDocument();
    const transition = JSON.parse(
      card?.getAttribute("data-transition") || "{}",
    );
    expect(transition.delay).toBe(0.1); // 100ms default delay / 1000
  });

  it("should apply custom delay", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    const { container } = render(
      <AnimatedAuthCard delay={250}>{testContent}</AnimatedAuthCard>,
    );

    // Assert
    const card = container.querySelector('[data-testid="animated-auth-card"]');
    const transition = JSON.parse(
      card?.getAttribute("data-transition") || "{}",
    );
    expect(transition.delay).toBe(0.25); // 250ms / 1000
  });

  it("should apply custom className", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    const { container } = render(
      <AnimatedAuthCard className="custom-class">
        {testContent}
      </AnimatedAuthCard>,
    );

    // Assert
    const card = container.querySelector('[data-testid="animated-auth-card"]');
    expect(card).toHaveClass("custom-class");
  });

  it("should have correct initial animation props", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    const { container } = render(
      <AnimatedAuthCard>{testContent}</AnimatedAuthCard>,
    );

    // Assert
    const card = container.querySelector('[data-testid="animated-auth-card"]');
    const initial = JSON.parse(card?.getAttribute("data-initial") || "{}");
    expect(initial).toEqual({
      opacity: 0,
      y: 40,
      scale: 0.95,
      filter: "blur(10px)",
    });
  });

  it("should have correct animate props", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    const { container } = render(
      <AnimatedAuthCard>{testContent}</AnimatedAuthCard>,
    );

    // Assert
    const card = container.querySelector('[data-testid="animated-auth-card"]');
    const animate = JSON.parse(card?.getAttribute("data-animate") || "{}");
    expect(animate).toEqual({
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
    });
  });

  it("should have correct transition props", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    const { container } = render(
      <AnimatedAuthCard>{testContent}</AnimatedAuthCard>,
    );

    // Assert
    const card = container.querySelector('[data-testid="animated-auth-card"]');
    const transition = JSON.parse(
      card?.getAttribute("data-transition") || "{}",
    );
    expect(transition).toMatchObject({
      duration: 0.8,
      delay: 0.1,
      ease: [0.25, 0.4, 0.25, 1],
    });
  });
});
