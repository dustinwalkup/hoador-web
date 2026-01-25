import { describe, it, expect } from "vitest";
import {
  normalizeCardBrand,
  getCardBrandDisplayName,
  getCardBrandColor,
  getCardBrandBgColor,
  isSupportedBrand,
} from "../card-brand";

describe("normalizeCardBrand", () => {
  it("should convert to lowercase", () => {
    expect(normalizeCardBrand("VISA")).toBe("visa");
    expect(normalizeCardBrand("MASTERCARD")).toBe("mastercard");
    expect(normalizeCardBrand("AmEx")).toBe("amex");
  });

  it("should trim whitespace", () => {
    expect(normalizeCardBrand("  visa  ")).toBe("visa");
    expect(normalizeCardBrand(" mastercard ")).toBe("mastercard");
    expect(normalizeCardBrand("\tamex\n")).toBe("amex");
  });

  it("should handle already normalized strings", () => {
    expect(normalizeCardBrand("visa")).toBe("visa");
    expect(normalizeCardBrand("mastercard")).toBe("mastercard");
    expect(normalizeCardBrand("amex")).toBe("amex");
  });

  it("should handle mixed case", () => {
    expect(normalizeCardBrand("ViSa")).toBe("visa");
    expect(normalizeCardBrand("MaStErCaRd")).toBe("mastercard");
    expect(normalizeCardBrand("AmEx")).toBe("amex");
  });

  it("should handle empty strings", () => {
    expect(normalizeCardBrand("")).toBe("");
  });

  it("should handle strings with only spaces", () => {
    expect(normalizeCardBrand("   ")).toBe("");
    expect(normalizeCardBrand("\t\n")).toBe("");
  });
});

describe("getCardBrandDisplayName", () => {
  const supportedBrands = [
    { input: "visa", expected: "Visa" },
    { input: "mastercard", expected: "Mastercard" },
    { input: "amex", expected: "American Express" },
    { input: "discover", expected: "Discover" },
    { input: "diners", expected: "Diners Club" },
    { input: "jcb", expected: "JCB" },
    { input: "unionpay", expected: "UnionPay" },
    { input: "elo", expected: "Elo" },
  ];

  it("should return correct display names for all supported brands", () => {
    supportedBrands.forEach(({ input, expected }) => {
      expect(getCardBrandDisplayName(input)).toBe(expected);
    });
  });

  it("should handle case-insensitive input", () => {
    expect(getCardBrandDisplayName("VISA")).toBe("Visa");
    expect(getCardBrandDisplayName("MasterCard")).toBe("Mastercard");
    expect(getCardBrandDisplayName("AMEX")).toBe("American Express");
    expect(getCardBrandDisplayName("  visa  ")).toBe("Visa");
  });

  it("should capitalize first letter for unknown brands", () => {
    expect(getCardBrandDisplayName("unknown")).toBe("Unknown");
    expect(getCardBrandDisplayName("custom")).toBe("Custom");
    expect(getCardBrandDisplayName("test")).toBe("Test");
  });

  it("should handle empty strings", () => {
    expect(getCardBrandDisplayName("")).toBe("");
  });

  it("should handle whitespace-only strings", () => {
    expect(getCardBrandDisplayName("   ")).toBe("   ");
    expect(getCardBrandDisplayName("\t\n")).toBe("\t\n");
  });

  it("should handle mixed case unknown brands", () => {
    // Function capitalizes first letter and keeps rest as-is
    expect(getCardBrandDisplayName("uNkNoWn")).toBe("UNkNoWn");
    expect(getCardBrandDisplayName("CuStOm")).toBe("CuStOm");
  });
});

describe("getCardBrandColor", () => {
  const brandColors = [
    { input: "visa", expected: "text-[#1434CB]" },
    { input: "mastercard", expected: "text-[#EB001B]" },
    { input: "amex", expected: "text-[#006FCF]" },
    { input: "discover", expected: "text-[#FF6000]" },
    { input: "diners", expected: "text-[#0079BE]" },
    { input: "jcb", expected: "text-[#0B4EA2]" },
    { input: "unionpay", expected: "text-[#E21836]" },
    { input: "elo", expected: "text-[#FFCB05]" },
  ];

  it("should return correct Tailwind color classes for all supported brands", () => {
    brandColors.forEach(({ input, expected }) => {
      expect(getCardBrandColor(input)).toBe(expected);
    });
  });

  it("should return default muted color for unknown brands", () => {
    expect(getCardBrandColor("unknown")).toBe("text-muted-foreground");
    expect(getCardBrandColor("custom")).toBe("text-muted-foreground");
    expect(getCardBrandColor("test")).toBe("text-muted-foreground");
  });

  it("should handle case-insensitive input", () => {
    expect(getCardBrandColor("VISA")).toBe("text-[#1434CB]");
    expect(getCardBrandColor("MasterCard")).toBe("text-[#EB001B]");
    expect(getCardBrandColor("  visa  ")).toBe("text-[#1434CB]");
  });

  it("should handle empty strings", () => {
    expect(getCardBrandColor("")).toBe("text-muted-foreground");
  });
});

describe("getCardBrandBgColor", () => {
  const brandBgColors = [
    { input: "visa", expected: "bg-[#1434CB]/10" },
    { input: "mastercard", expected: "bg-[#EB001B]/10" },
    { input: "amex", expected: "bg-[#006FCF]/10" },
    { input: "discover", expected: "bg-[#FF6000]/10" },
    { input: "diners", expected: "bg-[#0079BE]/10" },
    { input: "jcb", expected: "bg-[#0B4EA2]/10" },
    { input: "unionpay", expected: "bg-[#E21836]/10" },
    { input: "elo", expected: "bg-[#FFCB05]/10" },
  ];

  it("should return correct Tailwind background color classes for all supported brands", () => {
    brandBgColors.forEach(({ input, expected }) => {
      expect(getCardBrandBgColor(input)).toBe(expected);
    });
  });

  it("should return default muted background for unknown brands", () => {
    expect(getCardBrandBgColor("unknown")).toBe("bg-muted");
    expect(getCardBrandBgColor("custom")).toBe("bg-muted");
    expect(getCardBrandBgColor("test")).toBe("bg-muted");
  });

  it("should handle case-insensitive input", () => {
    expect(getCardBrandBgColor("VISA")).toBe("bg-[#1434CB]/10");
    expect(getCardBrandBgColor("MasterCard")).toBe("bg-[#EB001B]/10");
    expect(getCardBrandBgColor("  visa  ")).toBe("bg-[#1434CB]/10");
  });

  it("should handle empty strings", () => {
    expect(getCardBrandBgColor("")).toBe("bg-muted");
  });
});

describe("isSupportedBrand", () => {
  const supportedBrands = [
    "visa",
    "mastercard",
    "amex",
    "discover",
    "diners",
    "jcb",
    "unionpay",
    "elo",
  ];

  it("should return true for all supported brands", () => {
    supportedBrands.forEach((brand) => {
      expect(isSupportedBrand(brand)).toBe(true);
    });
  });

  it("should return false for unknown brands", () => {
    expect(isSupportedBrand("unknown")).toBe(false);
    expect(isSupportedBrand("custom")).toBe(false);
    expect(isSupportedBrand("test")).toBe(false);
    expect(isSupportedBrand("invalid")).toBe(false);
  });

  it("should handle case-insensitive input", () => {
    expect(isSupportedBrand("VISA")).toBe(true);
    expect(isSupportedBrand("MasterCard")).toBe(true);
    expect(isSupportedBrand("AMEX")).toBe(true);
    expect(isSupportedBrand("  visa  ")).toBe(true);
  });

  it("should handle empty strings", () => {
    expect(isSupportedBrand("")).toBe(false);
  });

  it("should handle whitespace-only strings", () => {
    expect(isSupportedBrand("   ")).toBe(false);
    expect(isSupportedBrand("\t\n")).toBe(false);
  });

  it("should handle partial matches", () => {
    expect(isSupportedBrand("vis")).toBe(false);
    expect(isSupportedBrand("visa123")).toBe(false);
    expect(isSupportedBrand("master")).toBe(false);
  });
});
