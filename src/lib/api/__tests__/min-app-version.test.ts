import { describe, it, expect } from "vitest";
import { isAppVersionBelowMinimum } from "../min-app-version";

describe("isAppVersionBelowMinimum", () => {
  it.each([
    ["1.0.0", "2.0.0"],
    ["1.9.9", "2.0.0"],
    ["2.0.0", "2.1.0"],
    ["2.1.0", "2.1.1"],
    ["1.10.0", "1.11.0"],
  ])("%s is below %s", (app, min) => {
    expect(isAppVersionBelowMinimum(app, min)).toBe(true);
  });

  it.each([
    ["2.0.0", "2.0.0"],
    ["2.0.1", "2.0.0"],
    ["2.1.0", "2.0.9"],
    ["3.0.0", "2.9.9"],
    // Numeric, not lexicographic: "1.10.0" > "1.9.0".
    ["1.10.0", "1.9.0"],
  ])("%s is not below %s", (app, min) => {
    expect(isAppVersionBelowMinimum(app, min)).toBe(false);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isAppVersionBelowMinimum(" 1.0.0 ", " 2.0.0 ")).toBe(true);
  });

  it.each(["", "1.0", "v1.0.0", "1.0.0-beta", "garbage"])(
    "fails open on an unparsable app version (%j)",
    (app) => {
      expect(isAppVersionBelowMinimum(app, "9.9.9")).toBe(false);
    },
  );

  it.each(["", "2", "2.0", "latest", "2.0.0.0"])(
    "fails open on an unparsable MIN_APP_VERSION (%j)",
    (min) => {
      expect(isAppVersionBelowMinimum("0.0.1", min)).toBe(false);
    },
  );
});
