import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MailboxSkeleton } from "../mailbox-skeleton";

describe("MailboxSkeleton", () => {
  it("should render skeleton placeholders for conversations", () => {
    // Act
    const { container } = render(<MailboxSkeleton />);

    // Assert
    // Check for skeleton elements (they have data-slot="skeleton")
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should render desktop layout skeleton", () => {
    // Act
    const { container } = render(<MailboxSkeleton />);

    // Assert
    // The desktop layout should have the md:flex class (hidden on mobile)
    const desktopLayout = container.querySelector(".md\\:flex");
    expect(desktopLayout).toBeInTheDocument();
  });

  it("should render mobile layout skeleton", () => {
    // Act
    const { container } = render(<MailboxSkeleton />);

    // Assert
    // The mobile layout should have the md:hidden class (visible on mobile only)
    const mobileLayout = container.querySelector(".md\\:hidden");
    expect(mobileLayout).toBeInTheDocument();
  });
});
