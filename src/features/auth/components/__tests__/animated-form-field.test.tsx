import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AnimatedFormField,
  AnimatedButton,
  AnimatedInputWrapper,
  formFieldVariants,
} from "../animated-form-field";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
      variants,
      initial,
      animate,
      transition,
      ...props
    }: any) => (
      <div
        className={className}
        data-testid="animated-form-field"
        data-variants={JSON.stringify(variants)}
        data-initial={initial}
        data-animate={animate}
        data-transition={JSON.stringify(transition)}
        {...props}
      >
        {children}
      </div>
    ),
    button: ({
      children,
      className,
      whileHover,
      whileTap,
      disabled,
      ...props
    }: any) => (
      <button
        className={className}
        disabled={disabled}
        data-testid="animated-button"
        data-while-hover={JSON.stringify(whileHover)}
        data-while-tap={JSON.stringify(whileTap)}
        {...props}
      >
        {children}
      </button>
    ),
  },
  type: {
    Variants: {},
  },
}));

describe("AnimatedFormField", () => {
  it("should render children content", () => {
    // Arrange
    const testContent = <div>Test Field Content</div>;

    // Act
    render(<AnimatedFormField>{testContent}</AnimatedFormField>);

    // Assert
    expect(screen.getByText("Test Field Content")).toBeInTheDocument();
  });

  it("should render with default delay", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    const { container } = render(
      <AnimatedFormField>{testContent}</AnimatedFormField>,
    );

    // Assert
    const field = container.querySelector(
      '[data-testid="animated-form-field"]',
    );
    expect(field).toBeInTheDocument();
    const transition = JSON.parse(
      field?.getAttribute("data-transition") || "{}",
    );
    expect(transition.delay).toBe(0); // default delay
  });

  it("should apply custom delay", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    const { container } = render(
      <AnimatedFormField delay={500}>{testContent}</AnimatedFormField>,
    );

    // Assert
    const field = container.querySelector(
      '[data-testid="animated-form-field"]',
    );
    const transition = JSON.parse(
      field?.getAttribute("data-transition") || "{}",
    );
    expect(transition.delay).toBe(0.5); // 500ms / 1000
  });

  it("should apply custom className", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    const { container } = render(
      <AnimatedFormField className="custom-field-class">
        {testContent}
      </AnimatedFormField>,
    );

    // Assert
    const field = container.querySelector(
      '[data-testid="animated-form-field"]',
    );
    expect(field).toHaveClass("custom-field-class");
  });

  it("should use formFieldVariants", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    const { container } = render(
      <AnimatedFormField>{testContent}</AnimatedFormField>,
    );

    // Assert
    const field = container.querySelector(
      '[data-testid="animated-form-field"]',
    );
    const variants = JSON.parse(field?.getAttribute("data-variants") || "{}");
    expect(variants).toEqual(formFieldVariants);
  });

  it("should have correct initial and animate states", () => {
    // Arrange
    const testContent = <div>Test Content</div>;

    // Act
    const { container } = render(
      <AnimatedFormField>{testContent}</AnimatedFormField>,
    );

    // Assert
    const field = container.querySelector(
      '[data-testid="animated-form-field"]',
    );
    expect(field?.getAttribute("data-initial")).toBe("hidden");
    expect(field?.getAttribute("data-animate")).toBe("visible");
  });
});

describe("AnimatedButton", () => {
  it("should render children content", () => {
    // Arrange
    const testContent = <span>Click Me</span>;

    // Act
    render(<AnimatedButton>{testContent}</AnimatedButton>);

    // Assert
    expect(screen.getByText("Click Me")).toBeInTheDocument();
  });

  it("should apply hover and tap animations when not disabled", () => {
    // Arrange
    const testContent = <span>Button</span>;

    // Act
    const { container } = render(
      <AnimatedButton disabled={false}>{testContent}</AnimatedButton>,
    );

    // Assert
    const button = container.querySelector('[data-testid="animated-button"]');
    const whileHover = JSON.parse(
      button?.getAttribute("data-while-hover") || "{}",
    );
    const whileTap = JSON.parse(button?.getAttribute("data-while-tap") || "{}");
    expect(whileHover).toEqual({ scale: 1.02 });
    expect(whileTap).toEqual({ scale: 0.98 });
  });

  it("should not apply hover and tap animations when disabled", () => {
    // Arrange
    const testContent = <span>Button</span>;

    // Act
    const { container } = render(
      <AnimatedButton disabled={true}>{testContent}</AnimatedButton>,
    );

    // Assert
    const button = container.querySelector('[data-testid="animated-button"]');
    const whileHover = JSON.parse(
      button?.getAttribute("data-while-hover") || "{}",
    );
    const whileTap = JSON.parse(button?.getAttribute("data-while-tap") || "{}");
    expect(whileHover).toEqual({});
    expect(whileTap).toEqual({});
    expect(button).toBeDisabled();
  });

  it("should apply custom className", () => {
    // Arrange
    const testContent = <span>Button</span>;

    // Act
    const { container } = render(
      <AnimatedButton className="custom-button-class">
        {testContent}
      </AnimatedButton>,
    );

    // Assert
    const button = container.querySelector('[data-testid="animated-button"]');
    expect(button).toHaveClass("custom-button-class");
  });

  it("should pass button type", () => {
    // Arrange
    const testContent = <span>Submit</span>;

    // Act
    const { container } = render(
      <AnimatedButton type="submit">{testContent}</AnimatedButton>,
    );

    // Assert
    const button = container.querySelector('[data-testid="animated-button"]');
    expect(button).toHaveAttribute("type", "submit");
  });

  it("should call onClick handler", () => {
    // Arrange
    const handleClick = vi.fn();
    const testContent = <span>Click</span>;

    // Act
    const { container } = render(
      <AnimatedButton onClick={handleClick}>{testContent}</AnimatedButton>,
    );

    const button = container.querySelector(
      '[data-testid="animated-button"]',
    ) as HTMLButtonElement;
    button?.click();

    // Assert
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("AnimatedInputWrapper", () => {
  it("should render children content", () => {
    // Arrange
    const testContent = <input type="text" />;

    // Act
    const { container } = render(
      <AnimatedInputWrapper>{testContent}</AnimatedInputWrapper>,
    );

    // Assert
    expect(container.querySelector("input")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    // Arrange
    const testContent = <input type="text" />;

    // Act
    const { container } = render(
      <AnimatedInputWrapper className="custom-wrapper-class">
        {testContent}
      </AnimatedInputWrapper>,
    );

    // Assert
    const wrapper = container.querySelector(
      '[data-testid="animated-form-field"]',
    );
    expect(wrapper).toHaveClass("custom-wrapper-class");
  });
});

describe("formFieldVariants", () => {
  it("should have correct hidden state", () => {
    expect(formFieldVariants.hidden).toEqual({
      opacity: 0,
      y: 20,
      filter: "blur(4px)",
    });
  });

  it("should have correct visible state", () => {
    expect(formFieldVariants.visible).toMatchObject({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    });
  });
});
