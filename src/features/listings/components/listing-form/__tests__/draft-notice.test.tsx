import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DraftNotice } from "../draft-notice";

describe("DraftNotice", () => {
  it("renders all three required phrases from Req 7.5", () => {
    render(<DraftNotice />);
    const notice = screen.getByTestId("ai-draft-notice");
    const text = notice.textContent ?? "";
    // (a) draft from photos
    expect(text).toMatch(/draft.*photos/i);
    // (b) AI can make mistakes
    expect(text).toMatch(/AI can make mistakes/i);
    // (c) proofread + edit every field
    expect(text).toMatch(/proofread/i);
    expect(text).toMatch(/edit.*every field/i);
  });

  it("renders no close affordance — the notice is non-dismissible (Req 7.5)", () => {
    render(<DraftNotice />);
    const notice = screen.getByTestId("ai-draft-notice");
    expect(within(notice).queryByRole("button")).toBeNull();
    // No `aria-label` pointing at dismiss/close either.
    expect(within(notice).queryByLabelText(/close|dismiss/i)).toBeNull();
  });

  it("uses the alert role for screen readers", () => {
    render(<DraftNotice />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
