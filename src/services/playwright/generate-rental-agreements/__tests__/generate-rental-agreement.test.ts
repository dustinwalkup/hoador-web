import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RentalAgreementData } from "../template";

const mockPdfBuffer = Buffer.from("%PDF-1.4 mock pdf content");

const mockPage = {
  setContent: vi.fn().mockResolvedValue(undefined),
  pdf: vi.fn().mockResolvedValue(mockPdfBuffer),
};

const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockChromium = {
  launch: vi.fn().mockResolvedValue(mockBrowser),
};

vi.mock("playwright", () => ({
  chromium: mockChromium,
}));

const mockRentalAgreementData: RentalAgreementData = {
  providerName: "Jane Owner",
  renterName: "John Renter",
  listingDescription: "Power drill - Heavy duty",
  startDate: "Feb 15, 2025",
  endDate: "Feb 18, 2025",
  rentalLocation: "123 Main St",
  totalRentalAmount: "$45.00",
};

describe("generateRentalAgreementPdf", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockChromium.launch.mockResolvedValue(mockBrowser);
    mockPage.setContent.mockResolvedValue(undefined);
    mockPage.pdf.mockResolvedValue(mockPdfBuffer);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockBrowser.close.mockResolvedValue(undefined);
  });

  it("returns a non-empty Buffer", async () => {
    const { generateRentalAgreementPdf } = await import("../utils");
    const buffer = await generateRentalAgreementPdf(mockRentalAgreementData);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("launches Chromium and calls setContent with HTML containing data", async () => {
    const { generateRentalAgreementPdf } = await import("../utils");
    await generateRentalAgreementPdf(mockRentalAgreementData);

    expect(mockChromium.launch).toHaveBeenCalled();
    expect(mockBrowser.newPage).toHaveBeenCalled();
    expect(mockPage.setContent).toHaveBeenCalled();
    const html = mockPage.setContent.mock.calls[0][0] as string;
    expect(html).toContain("Jane Owner");
    expect(html).toContain("John Renter");
    expect(html).toContain("$45.00");
    expect(mockPage.pdf).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it("closes browser even when pdf fails", async () => {
    mockPage.pdf.mockRejectedValueOnce(new Error("PDF failed"));

    const { generateRentalAgreementPdf } = await import("../utils");

    await expect(
      generateRentalAgreementPdf(mockRentalAgreementData),
    ).rejects.toThrow("PDF failed");

    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
