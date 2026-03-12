import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { PhotoTips, MAX_IMAGES } from "../photo-tips";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("PhotoTips", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports MAX_IMAGES as 10", () => {
    expect(MAX_IMAGES).toBe(10);
  });

  describe("empty state (imageCount === 0)", () => {
    it("renders all tip badges", () => {
      render(<PhotoTips imageCount={0} />);

      expect(screen.getByText("Horizontal")).toBeInTheDocument();
      expect(screen.getByText("Centered")).toBeInTheDocument();
      expect(screen.getByText("Hi-Res")).toBeInTheDocument();
    });

    it("renders badges with outline variant", () => {
      const { container } = render(<PhotoTips imageCount={0} />);

      const badges = container.querySelectorAll("[data-slot='badge']");
      expect(badges.length).toBe(3);
    });

    it("does not cycle tips when imageCount is 0", () => {
      render(<PhotoTips imageCount={0} />);

      // Advance timers - should not change to cycling mode
      act(() => {
        vi.advanceTimersByTime(8000);
      });

      // All badges should still be visible
      expect(screen.getByText("Horizontal")).toBeInTheDocument();
      expect(screen.getByText("Centered")).toBeInTheDocument();
      expect(screen.getByText("Hi-Res")).toBeInTheDocument();
    });
  });

  describe("with images (cycling tips)", () => {
    it("shows a single cycling tip when images exist", () => {
      render(<PhotoTips imageCount={3} />);

      // Should show the first tip
      expect(
        screen.getByText("Horizontal images look best in search results"),
      ).toBeInTheDocument();
    });

    it("cycles to the next tip after 4 seconds", () => {
      render(<PhotoTips imageCount={3} />);

      expect(
        screen.getByText("Horizontal images look best in search results"),
      ).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(
        screen.getByText("Center your subject in the frame"),
      ).toBeInTheDocument();
    });

    it("cycles through all tips and wraps around", () => {
      render(<PhotoTips imageCount={3} />);

      // Tip 0 → 1
      act(() => vi.advanceTimersByTime(4000));
      expect(
        screen.getByText("Center your subject in the frame"),
      ).toBeInTheDocument();

      // Tip 1 → 2
      act(() => vi.advanceTimersByTime(4000));
      expect(
        screen.getByText("Use the highest resolution available"),
      ).toBeInTheDocument();

      // Tip 2 → 0 (wrap)
      act(() => vi.advanceTimersByTime(4000));
      expect(
        screen.getByText("Horizontal images look best in search results"),
      ).toBeInTheDocument();
    });

    it("pauses cycling on mouse enter", () => {
      const { container } = render(<PhotoTips imageCount={3} />);
      const wrapper = container.firstElementChild as HTMLElement;

      // Hover to pause using fireEvent (works with React's synthetic events)
      fireEvent.mouseEnter(wrapper);

      act(() => vi.advanceTimersByTime(8000));

      // Should still show the first tip
      expect(
        screen.getByText("Horizontal images look best in search results"),
      ).toBeInTheDocument();
    });

    it("resumes cycling on mouse leave", () => {
      const { container } = render(<PhotoTips imageCount={3} />);
      const wrapper = container.firstElementChild as HTMLElement;

      // Pause
      fireEvent.mouseEnter(wrapper);

      // Resume
      fireEvent.mouseLeave(wrapper);

      act(() => vi.advanceTimersByTime(4000));

      expect(
        screen.getByText("Center your subject in the frame"),
      ).toBeInTheDocument();
    });
  });

  describe("at max images", () => {
    it("returns null when imageCount >= MAX_IMAGES", () => {
      const { container } = render(<PhotoTips imageCount={MAX_IMAGES} />);
      expect(container.firstChild).toBeNull();
    });

    it("returns null when imageCount exceeds MAX_IMAGES", () => {
      const { container } = render(<PhotoTips imageCount={MAX_IMAGES + 5} />);
      expect(container.firstChild).toBeNull();
    });
  });
});
