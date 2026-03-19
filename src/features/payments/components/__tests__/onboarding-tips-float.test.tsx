import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  TipsList,
  OnboardingTipsFloat,
  type OnboardingTip,
} from "../onboarding-tips-float";

// Render AnimatePresence children directly and motion.div as a plain div
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => <div className={className}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Render portal content inline instead of appending to document.body
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return { ...actual, createPortal: (node: ReactNode) => node };
});


const TIPS: OnboardingTip[] = [
  { label: 'Select "Individual"', detail: "" },
  { label: "Use hoador.com", detail: "for website" },
  { label: "Enter your legal name", detail: "(matches your ID)" },
  { label: "SSN + DOB are required", detail: "(secure verification)" },
  { label: "Use a bank account", detail: "in your name" },
];

describe("TipsList", () => {
  it("renders all tip labels", () => {
    render(<TipsList tips={TIPS} />);
    expect(screen.getByText('Select "Individual"')).toBeInTheDocument();
    expect(screen.getByText("Use hoador.com")).toBeInTheDocument();
    expect(screen.getByText("Enter your legal name")).toBeInTheDocument();
    expect(screen.getByText("SSN + DOB are required")).toBeInTheDocument();
    expect(screen.getByText("Use a bank account")).toBeInTheDocument();
  });

  it("renders tip detail text", () => {
    render(<TipsList tips={TIPS} />);
    expect(screen.getByText("for website")).toBeInTheDocument();
    expect(screen.getByText("(matches your ID)")).toBeInTheDocument();
    expect(screen.getByText("(secure verification)")).toBeInTheDocument();
    expect(screen.getByText("in your name")).toBeInTheDocument();
  });

  it("renders a list with the correct number of items", () => {
    render(<TipsList tips={TIPS} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(TIPS.length);
  });

  it("renders an empty list when no tips are provided", () => {
    render(<TipsList tips={[]} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("renders tip labels in bold", () => {
    render(<TipsList tips={[{ label: "Bold label", detail: "some detail" }]} />);
    const bold = screen.getByText("Bold label");
    expect(bold.tagName).toBe("STRONG");
  });
});

describe("OnboardingTipsFloat", () => {
  describe("visibility", () => {
    it("does not render when visible is false", () => {
      render(<OnboardingTipsFloat tips={TIPS} visible={false} />);
      expect(
        screen.queryByText("Need help with this form?"),
      ).not.toBeInTheDocument();
    });

    it("renders the trigger when visible is true", () => {
      render(<OnboardingTipsFloat tips={TIPS} visible={true} />);
      expect(
        screen.getByText("Need help with this form?"),
      ).toBeInTheDocument();
    });
  });

  describe("collapsed state (default)", () => {
    it("starts collapsed", () => {
      render(<OnboardingTipsFloat tips={TIPS} visible={true} />);
      const content = document.querySelector("[data-slot='collapsible-content']");
      expect(content).toHaveAttribute("data-state", "closed");
    });

    it("has collapsed data-state on the content when closed", () => {
      render(<OnboardingTipsFloat tips={TIPS} visible={true} />);
      const content = document.querySelector("[data-slot='collapsible-content']");
      expect(content).toHaveAttribute("data-state", "closed");
    });
  });

  describe("expanded state", () => {
    it("has open data-state on the content when trigger is clicked", () => {
      render(<OnboardingTipsFloat tips={TIPS} visible={true} />);
      fireEvent.click(screen.getByRole("button"));
      const content = document.querySelector("[data-slot='collapsible-content']");
      expect(content).toHaveAttribute("data-state", "open");
    });

    it("shows all tips when expanded", () => {
      render(<OnboardingTipsFloat tips={TIPS} visible={true} />);
      fireEvent.click(screen.getByRole("button"));
      expect(screen.getByRole("list")).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(TIPS.length);
    });

    it("shows the disclaimer when expanded", () => {
      render(<OnboardingTipsFloat tips={TIPS} visible={true} />);
      fireEvent.click(screen.getByRole("button"));
      expect(
        screen.getByText("Info must match your ID to avoid payout delays."),
      ).toBeInTheDocument();
    });

    it("collapses when the trigger is clicked again", () => {
      render(<OnboardingTipsFloat tips={TIPS} visible={true} />);
      const button = screen.getByRole("button");
      fireEvent.click(button); // open
      fireEvent.click(button); // close
      const content = document.querySelector("[data-slot='collapsible-content']");
      expect(content).toHaveAttribute("data-state", "closed");
    });
  });
});
