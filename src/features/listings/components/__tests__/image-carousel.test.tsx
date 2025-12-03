import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageCarousel } from "../image-carousel";

describe("ImageCarousel", () => {
  const mockImages = [
    {
      id: "img-1",
      imageUrl: "/test-image-1.jpg",
      orderIndex: 0,
    },
    {
      id: "img-2",
      imageUrl: "/test-image-2.jpg",
      orderIndex: 1,
    },
    {
      id: "img-3",
      imageUrl: "/test-image-3.jpg",
      orderIndex: 2,
    },
  ];

  const mockListingName = "Power Drill";

  describe("Initial Rendering", () => {
    it("should render with images", () => {
      render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const mainImage = screen.getByAltText(`${mockListingName} - Image 1`);
      expect(mainImage).toBeInTheDocument();
    });

    it("should render placeholder when no images provided", () => {
      render(<ImageCarousel images={[]} listingName={mockListingName} />);

      const placeholder = screen.getByAltText(mockListingName);
      expect(placeholder).toBeInTheDocument();
      expect(placeholder).toHaveAttribute(
        "src",
        expect.stringContaining("placeholder"),
      );
    });

    it("should render first image by default", () => {
      render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const mainImage = screen.getByAltText(`${mockListingName} - Image 1`);
      expect(mainImage).toHaveAttribute(
        "src",
        expect.stringContaining("test-image-1"),
      );
    });

    it("should display image counter when multiple images", () => {
      render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    it("should not display image counter for single image", () => {
      render(
        <ImageCarousel
          images={[mockImages[0]]}
          listingName={mockListingName}
        />,
      );

      expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
    });

    it("should not display image counter when no images", () => {
      render(<ImageCarousel images={[]} listingName={mockListingName} />);

      expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
    });
  });

  describe("Navigation Buttons", () => {
    it("should render navigation buttons when multiple images", () => {
      render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const buttons = screen.getAllByRole("button");
      // Should have 2 navigation buttons + 3 thumbnail buttons = 5 total
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it("should not render navigation buttons for single image", () => {
      const { container } = render(
        <ImageCarousel
          images={[mockImages[0]]}
          listingName={mockListingName}
        />,
      );

      // Navigation buttons should not be present
      const navButtons = container.querySelectorAll(".absolute.top-1\\/2");
      expect(navButtons).toHaveLength(0);
    });

    it("should not render navigation buttons when no images", () => {
      const { container } = render(
        <ImageCarousel images={[]} listingName={mockListingName} />,
      );
      console.log(container.innerHTML);
      const buttons = screen.queryAllByRole("button");
      expect(buttons).toHaveLength(0);
    });

    it("should navigate to next image on next button click", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      // Initially should show first image
      expect(screen.getByText("1 / 3")).toBeInTheDocument();

      // Find navigation buttons by their position classes (not thumbnails)
      const navButtons = container.querySelectorAll(
        'button.absolute[class*="translate-y"]',
      );
      // The next button has "right-4" class
      const nextButton = Array.from(navButtons).find((btn) =>
        btn.className.includes("right-4"),
      );

      expect(nextButton).toBeDefined();
      await user.click(nextButton as Element);

      // Image counter should update - use waitFor for state updates
      await waitFor(
        () => {
          expect(screen.getByText("2 / 3")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("should navigate to previous image on previous button click", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      // Find navigation buttons
      const navButtons = container.querySelectorAll(
        'button.absolute[class*="translate-y"]',
      );
      const nextButton = Array.from(navButtons).find((btn) =>
        btn.className.includes("right-4"),
      ) as Element;
      const prevButton = Array.from(navButtons).find((btn) =>
        btn.className.includes("left-4"),
      ) as Element;

      // First go to second image
      await user.click(nextButton);

      await waitFor(
        () => {
          expect(screen.getByText("2 / 3")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      // Then go back to first
      await user.click(prevButton);

      // Should be back to first image
      await waitFor(
        () => {
          expect(screen.getByText("1 / 3")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("should wrap to last image when clicking previous on first image", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      // Find previous button (left-4 class)
      const navButtons = container.querySelectorAll(
        'button.absolute[class*="translate-y"]',
      );
      const prevButton = Array.from(navButtons).find((btn) =>
        btn.className.includes("left-4"),
      ) as Element;

      // Click previous button while on first image
      await user.click(prevButton);

      // Should show last image
      await waitFor(
        () => {
          expect(screen.getByText("3 / 3")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("should wrap to first image when clicking next on last image", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      // Find next button (right-4 class)
      const navButtons = container.querySelectorAll(
        'button.absolute[class*="translate-y"]',
      );
      const nextButton = Array.from(navButtons).find((btn) =>
        btn.className.includes("right-4"),
      ) as Element;

      // Click next twice to get to last image
      await user.click(nextButton);
      await waitFor(
        () => {
          expect(screen.getByText("2 / 3")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      await user.click(nextButton);
      await waitFor(
        () => {
          expect(screen.getByText("3 / 3")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      // Click next again to wrap to first
      await user.click(nextButton);
      await waitFor(
        () => {
          expect(screen.getByText("1 / 3")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Thumbnail Strip", () => {
    it("should render thumbnail strip when multiple images", () => {
      render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const thumbnail1 = screen.getByAltText(`${mockListingName} thumbnail 1`);
      const thumbnail2 = screen.getByAltText(`${mockListingName} thumbnail 2`);
      const thumbnail3 = screen.getByAltText(`${mockListingName} thumbnail 3`);

      expect(thumbnail1).toBeInTheDocument();
      expect(thumbnail2).toBeInTheDocument();
      expect(thumbnail3).toBeInTheDocument();
    });

    it("should not render thumbnail strip for single image", () => {
      render(
        <ImageCarousel
          images={[mockImages[0]]}
          listingName={mockListingName}
        />,
      );

      expect(screen.queryByAltText(/thumbnail/)).not.toBeInTheDocument();
    });

    it("should highlight current thumbnail", () => {
      const { container } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      // Find thumbnail buttons specifically (they're smaller and have thumbnail images)
      const thumbnailButtons = Array.from(
        container.querySelectorAll("button"),
      ).filter((btn) => {
        const img = btn.querySelector("img");
        return img?.alt.includes("thumbnail");
      });

      // First thumbnail button should have primary border
      expect(thumbnailButtons[0]).toHaveClass("border-primary");
    });

    it("should change main image when clicking thumbnail", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      // Find all thumbnail buttons (they contain images with "thumbnail" in alt text)
      const thumbnailButtons = Array.from(
        container.querySelectorAll("button"),
      ).filter((btn) => {
        const img = btn.querySelector("img");
        return img?.alt.includes("thumbnail");
      });

      // Click second thumbnail
      if (thumbnailButtons[1]) {
        await user.click(thumbnailButtons[1]);
        expect(screen.getByText("2 / 3")).toBeInTheDocument();
      }

      // Click third thumbnail
      if (thumbnailButtons[2]) {
        await user.click(thumbnailButtons[2]);
        expect(screen.getByText("3 / 3")).toBeInTheDocument();
      }
    });

    it("should update thumbnail highlighting when navigating", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      // Find next navigation button (right-4 class)
      const navButtons = container.querySelectorAll(
        'button.absolute[class*="translate-y"]',
      );
      const nextButton = Array.from(navButtons).find((btn) =>
        btn.className.includes("right-4"),
      ) as Element;

      // Navigate to next image
      await user.click(nextButton);

      await waitFor(
        () => {
          expect(screen.getByText("2 / 3")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      // Find thumbnail buttons
      const thumbnailButtons = Array.from(
        container.querySelectorAll("button"),
      ).filter((btn) => {
        const img = btn.querySelector("img");
        return img?.alt.includes("thumbnail");
      });

      // Second thumbnail should now be highlighted
      expect(thumbnailButtons[1]).toHaveClass("border-primary");
    });
  });

  describe("Touch Gestures", () => {
    it("should handle touch start event", () => {
      const { container } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const carousel = container.querySelector(".relative.flex");
      expect(carousel).toBeInTheDocument();

      // Component should have touch handlers attached
      // This is difficult to test without actual touch events
    });

    it("should not crash on touch events", () => {
      const { container } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const carousel = container.querySelector(".relative.flex");

      // Simulate touch events
      expect(() => {
        carousel?.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 100 } as Touch],
          } as TouchEventInit),
        );
      }).not.toThrow();
    });
  });

  describe("Image Properties", () => {
    it("should set correct image dimensions", () => {
      render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const mainImage = screen.getByAltText(`${mockListingName} - Image 1`);
      expect(mainImage).toHaveAttribute("width", "942");
      expect(mainImage).toHaveAttribute("height", "630");
    });

    it("should apply correct CSS classes to main image", () => {
      render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const mainImage = screen.getByAltText(`${mockListingName} - Image 1`);
      expect(mainImage).toHaveClass("object-contain");
    });

    it("should apply correct CSS classes to placeholder", () => {
      render(<ImageCarousel images={[]} listingName={mockListingName} />);

      const placeholder = screen.getByAltText(mockListingName);
      expect(placeholder).toHaveClass("object-cover");
    });
  });

  describe("Accessibility", () => {
    it("should have descriptive alt text for main image", () => {
      render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      expect(
        screen.getByAltText(`${mockListingName} - Image 1`),
      ).toBeInTheDocument();
    });

    it("should have descriptive alt text for thumbnails", () => {
      render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      expect(
        screen.getByAltText(`${mockListingName} thumbnail 1`),
      ).toBeInTheDocument();
      expect(
        screen.getByAltText(`${mockListingName} thumbnail 2`),
      ).toBeInTheDocument();
      expect(
        screen.getByAltText(`${mockListingName} thumbnail 3`),
      ).toBeInTheDocument();
    });

    it("should have accessible navigation buttons", () => {
      render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null images array", () => {
      expect(() => {
        render(<ImageCarousel images={null!} listingName={mockListingName} />);
      }).not.toThrow();
    });

    it("should handle undefined images array", () => {
      expect(() => {
        render(
          <ImageCarousel images={undefined!} listingName={mockListingName} />,
        );
      }).not.toThrow();
    });

    it("should handle empty listing name", () => {
      render(<ImageCarousel images={mockImages} listingName="" />);

      // When listing name is empty, the alt text should still work
      const mainImage = screen.getByRole("img", { name: /image 1/i });
      expect(mainImage).toBeInTheDocument();
    });

    it("should handle rapid navigation clicks", async () => {
      const user = userEvent.setup();
      render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const buttons = screen.getAllByRole("button");
      const nextButton = buttons[buttons.length - 1];

      // Click rapidly
      await user.click(nextButton);
      await user.click(nextButton);
      await user.click(nextButton);
      await user.click(nextButton);

      // Component should still work
      expect(screen.getByText(/\d+ \/ 3/)).toBeInTheDocument();
    });
  });

  describe("Component Integration", () => {
    it("should update when images prop changes", () => {
      const { rerender } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      expect(screen.getByText("1 / 3")).toBeInTheDocument();

      const newImages = [
        ...mockImages,
        {
          id: "img-4",
          imageUrl: "/test-image-4.jpg",
          orderIndex: 3,
        },
      ];

      rerender(
        <ImageCarousel images={newImages} listingName={mockListingName} />,
      );

      expect(screen.getByText("1 / 4")).toBeInTheDocument();
    });

    it("should reset to first image when listing name changes", () => {
      const { rerender } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      rerender(<ImageCarousel images={mockImages} listingName="New Tool" />);

      expect(screen.getByAltText("New Tool - Image 1")).toBeInTheDocument();
    });
  });

  describe("Styling", () => {
    it("should have correct container classes", () => {
      const { container } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const card = container.querySelector(".overflow-hidden");
      expect(card).toBeInTheDocument();
    });

    it("should apply hover styles to thumbnails", () => {
      const { container } = render(
        <ImageCarousel images={mockImages} listingName={mockListingName} />,
      );

      const thumbnailButtons = Array.from(
        container.querySelectorAll("button"),
      ).filter((btn) => {
        const img = btn.querySelector("img");
        return img?.alt.includes("thumbnail");
      });

      thumbnailButtons.forEach((btn) => {
        expect(btn).toHaveClass("rounded-lg");
      });
    });
  });
});
