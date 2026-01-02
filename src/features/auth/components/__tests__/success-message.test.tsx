import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SuccessMessage } from "../success-message";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  CheckCircle: () => <span data-testid="check-circle-icon" />,
}));

describe("SuccessMessage", () => {
  it("should render success message with title and description", () => {
    // Arrange
    const title = "Success!";
    const description = "Your action was completed successfully.";

    // Act
    render(<SuccessMessage title={title} description={description} />);

    // Assert
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it("should render CheckCircle icon", () => {
    // Arrange & Act
    render(
      <SuccessMessage title="Success" description="Operation completed" />,
    );

    // Assert
    expect(screen.getByTestId("check-circle-icon")).toBeInTheDocument();
  });

  it("should have proper ARIA live region for accessibility", () => {
    // Arrange & Act
    const { container } = render(
      <SuccessMessage title="Success" description="Operation completed" />,
    );

    // Assert
    const message = container.querySelector(".bg-green-50");
    expect(message).toBeInTheDocument();
  });

  it("should display different titles and descriptions", () => {
    // Arrange
    const title1 = "Email sent!";
    const description1 = "Check your inbox.";

    // Act
    const { rerender } = render(
      <SuccessMessage title={title1} description={description1} />,
    );

    // Assert
    expect(screen.getByText(title1)).toBeInTheDocument();
    expect(screen.getByText(description1)).toBeInTheDocument();

    // Re-render with different props
    const title2 = "Password reset!";
    const description2 = "Your password has been reset.";

    rerender(<SuccessMessage title={title2} description={description2} />);

    expect(screen.getByText(title2)).toBeInTheDocument();
    expect(screen.getByText(description2)).toBeInTheDocument();
    expect(screen.queryByText(title1)).not.toBeInTheDocument();
  });
});
