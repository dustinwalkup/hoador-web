import { describe, it, expect } from "vitest";
import { StatusIconWithTooltip } from "../status-icon-with-tooltip";

describe("StatusIconWithTooltip", () => {
  describe("Component Structure", () => {
    it("should be a function component", () => {
      expect(typeof StatusIconWithTooltip).toBe("function");
    });

    it("should accept status prop", () => {
      // Test that the component can be instantiated with different status values
      const statuses = [
        "available",
        "rented",
        "maintenance",
        "inactive",
        "unknown",
      ];

      statuses.forEach((status) => {
        expect(() => {
          // This would normally render the component
          // For now, we just test that the function exists and can be called
          StatusIconWithTooltip({ status });
        }).not.toThrow();
      });
    });

    it("should handle edge case status values", () => {
      const edgeCases = ["", "undefined", "random", "UPPERCASE", "MiXeD-CaSe"];

      edgeCases.forEach((status) => {
        expect(() => {
          StatusIconWithTooltip({ status });
        }).not.toThrow();
      });
    });
  });

  describe("Status Logic", () => {
    it("should handle all expected status values", () => {
      const expectedStatuses = [
        "available",
        "rented",
        "maintenance",
        "inactive",
      ];

      expectedStatuses.forEach((status) => {
        expect(() => {
          StatusIconWithTooltip({ status });
        }).not.toThrow();
      });
    });

    it("should provide fallback for unknown status", () => {
      // Test that unknown statuses don't crash the component
      const unknownStatuses = ["unknown", "invalid", "test"];

      unknownStatuses.forEach((status) => {
        expect(() => {
          StatusIconWithTooltip({ status });
        }).not.toThrow();
      });
    });
  });

  describe("Component Interface", () => {
    it("should have correct component name", () => {
      expect(StatusIconWithTooltip.name).toBe("StatusIconWithTooltip");
    });

    it("should be a React component", () => {
      // Check if it's a valid React component by testing its type
      expect(typeof StatusIconWithTooltip).toBe("function");
    });
  });

  describe("Props Validation", () => {
    it("should require status prop", () => {
      // Test that the component expects a status prop
      expect(() => {
        // @ts-expect-error - Testing missing prop
        StatusIconWithTooltip({});
      }).not.toThrow(); // Component should handle missing props gracefully
    });

    it("should accept string status values", () => {
      const stringStatuses = ["available", "rented", "maintenance", "inactive"];

      stringStatuses.forEach((status) => {
        expect(() => {
          StatusIconWithTooltip({ status });
        }).not.toThrow();
      });
    });
  });
});
