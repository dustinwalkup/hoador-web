import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type AiDraft } from "@/features/listings/ai-listing-assistant/types";

import { PROCESSING_STEPS, ProcessingView } from "../processing-view";

function fullDraft(overrides: Partial<AiDraft> = {}): AiDraft {
  return {
    name: "DeWalt 20V Cordless Drill",
    description: "A solid cordless drill.",
    categoryId: "uuid-power-tools",
    brand: "DeWalt",
    model: "DCD777C2",
    condition: "good",
    specifications: { power: "20V MAX" },
    instructions: null,
    safetyNotes: null,
    ...overrides,
  };
}

describe("ProcessingView", () => {
  it("renders the 'less than 10 seconds' expectation copy (Req 6.4)", () => {
    render(<ProcessingView currentStepIndex={0} evidenceDraft={null} />);
    expect(
      screen.getByTestId("ai-modal-processing-expectation").textContent,
    ).toMatch(/less than 10 seconds/i);
  });

  it("renders all five steps in script order with the canonical labels", () => {
    render(<ProcessingView currentStepIndex={0} evidenceDraft={null} />);
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(
      PROCESSING_STEPS.map((s) => s.label),
    );
  });

  it("marks steps as done/active/pending based on currentStepIndex", () => {
    render(<ProcessingView currentStepIndex={2} evidenceDraft={null} />);
    expect(screen.getByTestId("ai-modal-step-analyze")).toHaveAttribute(
      "data-status",
      "done",
    );
    expect(screen.getByTestId("ai-modal-step-identify")).toHaveAttribute(
      "data-status",
      "done",
    );
    expect(screen.getByTestId("ai-modal-step-specs")).toHaveAttribute(
      "data-status",
      "active",
    );
    expect(screen.getByTestId("ai-modal-step-draft")).toHaveAttribute(
      "data-status",
      "pending",
    );
    expect(screen.getByTestId("ai-modal-step-prepare")).toHaveAttribute(
      "data-status",
      "pending",
    );
  });

  it("does not render evidence callouts when evidenceDraft is null", () => {
    render(<ProcessingView currentStepIndex={0} evidenceDraft={null} />);
    expect(
      screen.queryByTestId("ai-modal-evidence-callouts"),
    ).not.toBeInTheDocument();
  });

  it("renders all four callouts when the draft has every signal", () => {
    render(
      <ProcessingView
        currentStepIndex={PROCESSING_STEPS.length - 1}
        evidenceDraft={fullDraft()}
      />,
    );
    expect(
      screen.getByTestId("ai-modal-evidence-category"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("ai-modal-evidence-brand")).toBeInTheDocument();
    expect(screen.getByTestId("ai-modal-evidence-model")).toBeInTheDocument();
    expect(screen.getByTestId("ai-modal-evidence-specs")).toBeInTheDocument();
  });

  it("omits the model callout when AI did not extract a model (Req 6.5)", () => {
    render(
      <ProcessingView
        currentStepIndex={PROCESSING_STEPS.length - 1}
        evidenceDraft={fullDraft({ model: null })}
      />,
    );
    expect(screen.getByTestId("ai-modal-evidence-brand")).toBeInTheDocument();
    expect(
      screen.queryByTestId("ai-modal-evidence-model"),
    ).not.toBeInTheDocument();
  });

  it("omits the brand callout when AI did not extract a brand", () => {
    render(
      <ProcessingView
        currentStepIndex={PROCESSING_STEPS.length - 1}
        evidenceDraft={fullDraft({ brand: null })}
      />,
    );
    expect(
      screen.queryByTestId("ai-modal-evidence-brand"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-modal-evidence-model")).toBeInTheDocument();
  });

  it("omits the category callout when categoryId did not resolve", () => {
    render(
      <ProcessingView
        currentStepIndex={PROCESSING_STEPS.length - 1}
        evidenceDraft={fullDraft({ categoryId: null })}
      />,
    );
    expect(
      screen.queryByTestId("ai-modal-evidence-category"),
    ).not.toBeInTheDocument();
  });

  it("omits the specs callout when specifications object is empty", () => {
    render(
      <ProcessingView
        currentStepIndex={PROCESSING_STEPS.length - 1}
        evidenceDraft={fullDraft({ specifications: {} })}
      />,
    );
    expect(
      screen.queryByTestId("ai-modal-evidence-specs"),
    ).not.toBeInTheDocument();
  });

  it("does not render any callouts container when no fields qualify", () => {
    render(
      <ProcessingView
        currentStepIndex={PROCESSING_STEPS.length - 1}
        evidenceDraft={fullDraft({
          categoryId: null,
          brand: null,
          model: null,
          specifications: {},
        })}
      />,
    );
    expect(
      screen.queryByTestId("ai-modal-evidence-callouts"),
    ).not.toBeInTheDocument();
  });

  it("avoids AI/inference jargon in the visible copy (Req 6.3)", () => {
    render(<ProcessingView currentStepIndex={2} evidenceDraft={fullDraft()} />);
    const root = screen.getByTestId("ai-modal-processing");
    const text = root.textContent ?? "";
    expect(text).not.toMatch(/OpenAI/i);
    expect(text).not.toMatch(/gpt-?4/i);
    expect(text).not.toMatch(/inference/i);
    expect(text).not.toMatch(/multimodal/i);
  });
});
