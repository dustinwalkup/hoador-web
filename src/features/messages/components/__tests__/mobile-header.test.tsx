import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileHeader } from "../mobile-header";

describe("MobileHeader", () => {
  it("should render header with title and description", () => {
    // Arrange
    const title = "Messages";
    const description = "Your conversations";

    // Act
    render(<MobileHeader title={title} description={description} />);

    // Assert
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it("should render title as heading", () => {
    // Arrange
    const title = "Messages";
    const description = "Your conversations";

    // Act
    render(<MobileHeader title={title} description={description} />);

    // Assert
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(title);
  });

  it("should apply correct styling classes", () => {
    // Arrange
    const title = "Messages";
    const description = "Your conversations";

    // Act
    const { container } = render(
      <MobileHeader title={title} description={description} />,
    );

    // Assert
    const header = container.querySelector("div");
    expect(header).toHaveClass("border-b", "border-gray-200", "p-4");
  });
});
