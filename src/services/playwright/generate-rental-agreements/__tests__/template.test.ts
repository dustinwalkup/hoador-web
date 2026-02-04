import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  RENTAL_AGREEMENT_TEMPLATE_VERSION,
  type RentalAgreementData,
} from "../template";

describe("rental agreement template", () => {
  describe("RENTAL_AGREEMENT_TEMPLATE_VERSION", () => {
    it("is 1.0", () => {
      expect(RENTAL_AGREEMENT_TEMPLATE_VERSION).toBe("1.0");
    });
  });

  describe("renderTemplate", () => {
    const fullData: RentalAgreementData = {
      providerName: "Jane Owner",
      renterName: "John Renter",
      listingDescription: "Power drill - Heavy duty",
      startDate: "Feb 15, 2025",
      endDate: "Feb 18, 2025",
      rentalLocation: "123 Main St, City, ST 12345",
      totalRentalAmount: "$45.00",
    };

    it("output contains provider name", () => {
      const html = renderTemplate(fullData);
      expect(html).toContain("Jane Owner");
    });

    it("output contains renter name", () => {
      const html = renderTemplate(fullData);
      expect(html).toContain("John Renter");
    });

    it("output contains listing description", () => {
      const html = renderTemplate(fullData);
      expect(html).toContain("Power drill - Heavy duty");
    });

    it("output contains start and end dates", () => {
      const html = renderTemplate(fullData);
      expect(html).toContain("Feb 15, 2025");
      expect(html).toContain("Feb 18, 2025");
    });

    it("output contains rental location", () => {
      const html = renderTemplate(fullData);
      expect(html).toContain("123 Main St, City, ST 12345");
    });

    it("output contains total rental amount", () => {
      const html = renderTemplate(fullData);
      expect(html).toContain("$45.00");
    });

    it("uses N/A for missing or empty optional fields", () => {
      const partialData: RentalAgreementData = {
        providerName: "Provider",
        renterName: "Renter",
        listingDescription: "",
        startDate: "",
        endDate: "",
        rentalLocation: "",
        totalRentalAmount: "",
      };
      const html = renderTemplate(partialData);
      expect(html).toContain("Provider");
      expect(html).toContain("Renter");
      // Empty string fields become N/A
      expect(html).toContain("N/A");
    });

    it("escapes HTML in data", () => {
      const dataWithHtml: RentalAgreementData = {
        ...fullData,
        providerName: "<script>alert(1)</script>",
        renterName: "Bob & Co",
      };
      const html = renderTemplate(dataWithHtml);
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(html).toContain("Bob &amp; Co");
      expect(html).not.toContain("<script>");
    });

    it("includes agreement section headings", () => {
      const html = renderTemplate(fullData);
      expect(html).toContain("Parties and Transaction Details");
      expect(html).toContain("Condition and Inspection");
      expect(html).toContain("Governing Law");
    });
  });
});
