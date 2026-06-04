import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type AiPrefilledFieldKey } from "@/features/listings/ai-listing-assistant/types";

import { AiPrefillProvider } from "../ai-prefill-context";
import { AISuggestedBadge } from "../ai-suggested-badge";

function withProvider(fields: AiPrefilledFieldKey[], ui: React.ReactNode) {
  return (
    <AiPrefillProvider prefilledFields={new Set(fields)}>
      {ui}
    </AiPrefillProvider>
  );
}

describe("AISuggestedBadge", () => {
  it("renders the icon and 'AI Suggested' label when the field is in the prefilled set", () => {
    render(withProvider(["name"], <AISuggestedBadge fieldKey="name" />));

    const badge = screen.getByTestId("ai-suggested-badge-name");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toMatch(/AI Suggested/i);
    expect(badge.querySelector("svg")).toBeInTheDocument();
  });

  it("renders nothing outside the provider (manual flow stays clean — Req 7.4)", () => {
    render(<AISuggestedBadge fieldKey="name" />);
    expect(
      screen.queryByTestId("ai-suggested-badge-name"),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when the field is not in the prefilled set", () => {
    render(withProvider(["brand"], <AISuggestedBadge fieldKey="name" />));
    expect(
      screen.queryByTestId("ai-suggested-badge-name"),
    ).not.toBeInTheDocument();
  });

  it("only renders for the specific fieldKey passed in", () => {
    render(
      withProvider(
        ["name", "brand"],
        <>
          <AISuggestedBadge fieldKey="name" />
          <AISuggestedBadge fieldKey="brand" />
          <AISuggestedBadge fieldKey="model" />
        </>,
      ),
    );
    expect(screen.getByTestId("ai-suggested-badge-name")).toBeInTheDocument();
    expect(screen.getByTestId("ai-suggested-badge-brand")).toBeInTheDocument();
    expect(
      screen.queryByTestId("ai-suggested-badge-model"),
    ).not.toBeInTheDocument();
  });
});
