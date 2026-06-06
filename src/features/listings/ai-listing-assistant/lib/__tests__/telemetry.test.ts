import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emitAiEvent } from "../telemetry";

describe("emitAiEvent", () => {
  const consoleInfo = vi.spyOn(console, "info");
  // The shim no-ops in test by design (Req 12 — instrumentation should not
  // pollute test output). For coverage we flip the env var before each case.
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    consoleInfo.mockReset();
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv ?? "test");
    vi.unstubAllEnvs();
  });

  it("emits a structured payload with event name and a timestamp", () => {
    emitAiEvent("listing_create_modal_opened", {
      entryPath: "create_listing_page",
    });
    expect(consoleInfo).toHaveBeenCalledOnce();
    const payload = consoleInfo.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.event).toBe("listing_create_modal_opened");
    expect(payload.entryPath).toBe("create_listing_page");
    expect(typeof payload.ts).toBe("number");
  });

  it("does not emit in NODE_ENV=test (default in this suite without override)", () => {
    vi.stubEnv("NODE_ENV", "test");
    emitAiEvent("listing_create_choice_selected", { choice: "ai" });
    expect(consoleInfo).not.toHaveBeenCalled();
  });

  it("forwards arbitrary props verbatim", () => {
    emitAiEvent("listing_ai_generation_succeeded", {
      photoCount: 3,
      prefilledFields: ["name", "categoryId"],
      categoryResolved: true,
      conditionResolved: false,
    });
    const payload = consoleInfo.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.photoCount).toBe(3);
    expect(payload.prefilledFields).toEqual(["name", "categoryId"]);
    expect(payload.categoryResolved).toBe(true);
    expect(payload.conditionResolved).toBe(false);
  });
});
