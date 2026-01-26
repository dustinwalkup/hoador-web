import { describe, it, expect } from "vitest";
import { formatDisputeId, formatDisputeIdentifier } from "../format-dispute-id";

describe("formatDisputeId", () => {
  describe("null reference number", () => {
    it("should return 'DSP-0000' when referenceNumber is null", () => {
      expect(formatDisputeId(null)).toBe("DSP-0000");
    });
  });

  describe("single digit numbers", () => {
    it("should format 0 as 'DSP-0000'", () => {
      expect(formatDisputeId(0)).toBe("DSP-0000");
    });

    it("should format 1 as 'DSP-0001'", () => {
      expect(formatDisputeId(1)).toBe("DSP-0001");
    });

    it("should format 9 as 'DSP-0009'", () => {
      expect(formatDisputeId(9)).toBe("DSP-0009");
    });
  });

  describe("double digit numbers", () => {
    it("should format 10 as 'DSP-0010'", () => {
      expect(formatDisputeId(10)).toBe("DSP-0010");
    });

    it("should format 42 as 'DSP-0042'", () => {
      expect(formatDisputeId(42)).toBe("DSP-0042");
    });

    it("should format 99 as 'DSP-0099'", () => {
      expect(formatDisputeId(99)).toBe("DSP-0099");
    });
  });

  describe("triple digit numbers", () => {
    it("should format 100 as 'DSP-0100'", () => {
      expect(formatDisputeId(100)).toBe("DSP-0100");
    });

    it("should format 123 as 'DSP-0123'", () => {
      expect(formatDisputeId(123)).toBe("DSP-0123");
    });

    it("should format 999 as 'DSP-0999'", () => {
      expect(formatDisputeId(999)).toBe("DSP-0999");
    });
  });

  describe("four digit numbers", () => {
    it("should format 1000 as 'DSP-1000'", () => {
      expect(formatDisputeId(1000)).toBe("DSP-1000");
    });

    it("should format 1234 as 'DSP-1234'", () => {
      expect(formatDisputeId(1234)).toBe("DSP-1234");
    });

    it("should format 9999 as 'DSP-9999'", () => {
      expect(formatDisputeId(9999)).toBe("DSP-9999");
    });
  });

  describe("larger numbers", () => {
    it("should format 10000 as 'DSP-10000'", () => {
      expect(formatDisputeId(10000)).toBe("DSP-10000");
    });

    it("should format 12345 as 'DSP-12345'", () => {
      expect(formatDisputeId(12345)).toBe("DSP-12345");
    });

    it("should format 99999 as 'DSP-99999'", () => {
      expect(formatDisputeId(99999)).toBe("DSP-99999");
    });
  });
});

describe("formatDisputeIdentifier", () => {
  describe("without tool name", () => {
    it("should return formatted ID when toolName is undefined", () => {
      expect(formatDisputeIdentifier(42)).toBe("DSP-0042");
    });

    it("should return formatted ID when toolName is not provided", () => {
      expect(formatDisputeIdentifier(1)).toBe("DSP-0001");
    });

    it("should return 'DSP-0000' when referenceNumber is null and toolName is undefined", () => {
      expect(formatDisputeIdentifier(null)).toBe("DSP-0000");
    });
  });

  describe("with tool name", () => {
    it("should format with tool name when provided", () => {
      expect(formatDisputeIdentifier(42, "Power Drill")).toBe(
        "DSP-0042: Power Drill",
      );
    });

    it("should format with tool name for single digit reference number", () => {
      expect(formatDisputeIdentifier(1, "Hammer")).toBe("DSP-0001: Hammer");
    });

    it("should format with tool name for null reference number", () => {
      expect(formatDisputeIdentifier(null, "Circular Saw")).toBe(
        "DSP-0000: Circular Saw",
      );
    });

    it("should format with tool name for large reference numbers", () => {
      expect(formatDisputeIdentifier(1234, "Table Saw")).toBe(
        "DSP-1234: Table Saw",
      );
    });

    it("should handle tool names with special characters", () => {
      expect(formatDisputeIdentifier(42, "Drill & Driver Set")).toBe(
        "DSP-0042: Drill & Driver Set",
      );
    });

    it("should return formatted ID when toolName is empty string (falsy)", () => {
      expect(formatDisputeIdentifier(42, "")).toBe("DSP-0042");
    });

    it("should handle tool names with numbers", () => {
      expect(formatDisputeIdentifier(42, "Tool 123")).toBe(
        "DSP-0042: Tool 123",
      );
    });
  });
});
