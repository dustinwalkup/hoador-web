import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindStaleProcessingRecords = vi.fn();
vi.mock("@/dal", () => ({
  paymentLifecycleDAL: {
    findStaleProcessingRecords: (...args: unknown[]) =>
      mockFindStaleProcessingRecords(...args),
  },
}));

const mockSendOpsAlert = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...args: unknown[]) => mockSendOpsAlert(...args),
}));

const STALE_ENV = "STALE_PROCESSING_THRESHOLD_MINUTES";

describe("StaleProcessingDetectionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[STALE_ENV];
  });

  it("sends ops alert with rental ids and count when stale records found", async () => {
    const { StaleProcessingDetectionService } =
      await import("../stale-processing-detection-service");
    const rentalIds = ["rental-1", "rental-2"];
    mockFindStaleProcessingRecords.mockResolvedValue(
      rentalIds.map((rentalId) => ({
        rentalId,
        payoutStatus: "processing",
        updatedAt: new Date(),
      })),
    );

    const result =
      await StaleProcessingDetectionService.detectStaleProcessing(60);

    expect(result).toEqual({
      staleCount: 2,
      rentalIds,
      thresholdMinutes: 60,
    });
    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "stale_processing_detected",
        rentalId: "rental-1",
        message: expect.stringContaining("2 rental(s) stuck"),
        metadata: {
          staleCount: 2,
          rentalIds,
          thresholdMinutes: 60,
        },
        sendEmailAlert: true,
      }),
    );
  });

  it("returns staleCount 0 and does not send alert when no stale records", async () => {
    const { StaleProcessingDetectionService } =
      await import("../stale-processing-detection-service");
    mockFindStaleProcessingRecords.mockResolvedValue([]);

    const result =
      await StaleProcessingDetectionService.detectStaleProcessing(120);

    expect(result).toEqual({
      staleCount: 0,
      rentalIds: [],
      thresholdMinutes: 120,
    });
    expect(mockSendOpsAlert).not.toHaveBeenCalled();
  });

  it("uses threshold from env var when provided", async () => {
    process.env[STALE_ENV] = "45";
    const { StaleProcessingDetectionService } =
      await import("../stale-processing-detection-service");
    mockFindStaleProcessingRecords.mockResolvedValue([]);

    await StaleProcessingDetectionService.detectStaleProcessing();

    expect(mockFindStaleProcessingRecords).toHaveBeenCalledWith(45);
  });

  it("uses default threshold (60) when env not set or invalid", async () => {
    const { StaleProcessingDetectionService } =
      await import("../stale-processing-detection-service");
    mockFindStaleProcessingRecords.mockResolvedValue([]);

    await StaleProcessingDetectionService.detectStaleProcessing();

    expect(mockFindStaleProcessingRecords).toHaveBeenCalledWith(60);
  });

  it("uses explicit threshold over env when passed", async () => {
    process.env[STALE_ENV] = "30";
    const { StaleProcessingDetectionService } =
      await import("../stale-processing-detection-service");
    mockFindStaleProcessingRecords.mockResolvedValue([]);

    await StaleProcessingDetectionService.detectStaleProcessing(90);

    expect(mockFindStaleProcessingRecords).toHaveBeenCalledWith(90);
  });

  it("does not modify any lifecycle records (read-only)", async () => {
    const { StaleProcessingDetectionService } =
      await import("../stale-processing-detection-service");
    mockFindStaleProcessingRecords.mockResolvedValue([
      { rentalId: "r1", payoutStatus: "processing", updatedAt: new Date() },
    ]);

    await StaleProcessingDetectionService.detectStaleProcessing(60);

    expect(mockFindStaleProcessingRecords).toHaveBeenCalledTimes(1);
  });
});
