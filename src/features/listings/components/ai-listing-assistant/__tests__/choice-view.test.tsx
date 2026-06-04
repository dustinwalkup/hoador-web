import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChoiceView } from "../choice-view";

describe("ChoiceView", () => {
  it("renders both options with the framed copy (Req 1.3)", () => {
    render(<ChoiceView onChooseAi={vi.fn()} onChooseManual={vi.fn()} />);

    // Framing must be "Generate from Photos" / "Fill Out Manually" — not
    // language implying autonomous creation.
    expect(screen.getByText("Generate from Photos")).toBeInTheDocument();
    expect(screen.getByText("Fill Out Manually")).toBeInTheDocument();
  });

  it("fires onChooseAi when the AI option is clicked", async () => {
    const onChooseAi = vi.fn();
    const onChooseManual = vi.fn();

    render(
      <ChoiceView onChooseAi={onChooseAi} onChooseManual={onChooseManual} />,
    );

    await userEvent.click(screen.getByTestId("ai-modal-choice-ai"));

    expect(onChooseAi).toHaveBeenCalledOnce();
    expect(onChooseManual).not.toHaveBeenCalled();
  });

  it("fires onChooseManual when the Manual option is clicked", async () => {
    const onChooseAi = vi.fn();
    const onChooseManual = vi.fn();

    render(
      <ChoiceView onChooseAi={onChooseAi} onChooseManual={onChooseManual} />,
    );

    await userEvent.click(screen.getByTestId("ai-modal-choice-manual"));

    expect(onChooseManual).toHaveBeenCalledOnce();
    expect(onChooseAi).not.toHaveBeenCalled();
  });

  it("does not use autonomous-creation framing (Req 1.3)", () => {
    render(<ChoiceView onChooseAi={vi.fn()} onChooseManual={vi.fn()} />);

    const root = screen.getByTestId("ai-modal-choice");
    const text = root.textContent ?? "";
    expect(text).not.toMatch(/automatically/i);
    expect(text).not.toMatch(/AI creates your listing/i);
  });
});
