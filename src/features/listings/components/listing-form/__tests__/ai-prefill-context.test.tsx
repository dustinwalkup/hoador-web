import { render, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type AiPrefilledFieldKey } from "@/features/listings/ai-listing-assistant/types";

import { AiPrefillProvider, useAiPrefill } from "../ai-prefill-context";

describe("useAiPrefill", () => {
  it("returns null when no provider is mounted (manual flow stays unchanged)", () => {
    const { result } = renderHook(() => useAiPrefill());
    expect(result.current).toBeNull();
  });

  it("exposes the prefilledFields set when inside a provider", () => {
    const fields = new Set<AiPrefilledFieldKey>(["name", "brand"]);
    const { result } = renderHook(() => useAiPrefill(), {
      wrapper: ({ children }) => (
        <AiPrefillProvider prefilledFields={fields}>
          {children}
        </AiPrefillProvider>
      ),
    });

    expect(result.current).not.toBeNull();
    expect(result.current?.prefilledFields).toBe(fields);
    expect(result.current?.prefilledFields.has("name")).toBe(true);
    expect(result.current?.prefilledFields.has("model")).toBe(false);
  });

  it("renders children inside the provider without modification", () => {
    const fields = new Set<AiPrefilledFieldKey>();
    const { getByText } = render(
      <AiPrefillProvider prefilledFields={fields}>
        <span>child content</span>
      </AiPrefillProvider>,
    );
    expect(getByText("child content")).toBeInTheDocument();
  });
});
