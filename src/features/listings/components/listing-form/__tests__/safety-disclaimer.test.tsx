import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SafetyDisclaimer } from "../safety-disclaimer";

describe("SafetyDisclaimer", () => {
  it("carries the owner-responsibility framing (Req 7.6)", () => {
    render(<SafetyDisclaimer />);
    const disclaimer = screen.getByTestId("ai-safety-disclaimer");
    const text = disclaimer.textContent ?? "";
    // "Starting point only" + "may be incomplete or inaccurate"
    expect(text).toMatch(/starting point/i);
    expect(text).toMatch(/incomplete or inaccurate/i);
    // Owner-responsibility framing
    expect(text).toMatch(/owner.*responsible|responsible.*owner/i);
    expect(text).toMatch(/review/i);
    expect(text).toMatch(/safety/i);
  });

  it("renders a warning icon", () => {
    const { container } = render(<SafetyDisclaimer />);
    // lucide-react icons render as <svg> elements
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("is non-dismissible — no close button or collapse affordance (Req 7.6)", () => {
    render(<SafetyDisclaimer />);
    const disclaimer = screen.getByTestId("ai-safety-disclaimer");
    expect(within(disclaimer).queryByRole("button")).toBeNull();
    expect(
      within(disclaimer).queryByLabelText(/close|dismiss|collapse|show more/i),
    ).toBeNull();
  });

  it("uses destructive/warning Alert styling so it is visually distinct from the draft notice", () => {
    render(<SafetyDisclaimer />);
    const disclaimer = screen.getByTestId("ai-safety-disclaimer");
    // The destructive Alert variant carries a text-destructive class. We
    // check the class to confirm the variant choice without coupling to
    // every Tailwind utility.
    expect(disclaimer.className).toMatch(/destructive/);
  });

  it("uses the alert role so screen readers announce it", () => {
    render(<SafetyDisclaimer />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
