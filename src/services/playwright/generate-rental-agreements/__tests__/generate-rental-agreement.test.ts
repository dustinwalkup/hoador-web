import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RentalAgreementData } from "../template";

const { mockPdfBuffer, mockPage, mockBrowser } = vi.hoisted(() => {
  const buf = Buffer.from("%PDF-1.4 mock pdf content");
  const page = {
    setContent: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(buf),
  };
  const browser = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { mockPdfBuffer: buf, mockPage: page, mockBrowser: browser };
});

vi.mock("../../launch-browser", () => ({
  launchBrowser: vi.fn().mockResolvedValue(mockBrowser),
}));

import { launchBrowser } from "../../launch-browser";
import { generateRentalAgreementPdf } from "../utils";

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
  beforeEach(() => {
    vi.clearAllMocks();
    (launchBrowser as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);
    mockPage.setContent.mockResolvedValue(undefined);
    mockPage.pdf.mockResolvedValue(mockPdfBuffer);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockBrowser.close.mockResolvedValue(undefined);
  });

  it("returns a non-empty Buffer", async () => {
    const buffer = await generateRentalAgreementPdf(mockRentalAgreementData);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("launches browser and calls setContent with HTML containing data", async () => {
    await generateRentalAgreementPdf(mockRentalAgreementData);

    expect(launchBrowser).toHaveBeenCalled();
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

    await expect(
      generateRentalAgreementPdf(mockRentalAgreementData),
    ).rejects.toThrow("PDF failed");

    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
