import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeToolImageAction } from "../analyze-tool-image";

// Mock the analyzeToolImage service
vi.mock("@/services/openai/analyze-tool-image", () => ({
  analyzeToolImage: vi.fn(),
}));

describe("analyzeToolImageAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should analyze image successfully and return tool data", async () => {
    // Arrange
    const { analyzeToolImage } =
      await import("@/services/openai/analyze-tool-image");
    const mockImageUrls = ["https://example.com/image1.jpg"];
    const mockAnalysisResult = {
      name: "DeWalt Cordless Drill",
      description: "A powerful cordless drill",
      categoryName: "Power Tools",
      brand: "DeWalt",
      model: "DCD777C2",
      condition: "good" as const,
      specifications: {
        power: "20V MAX",
        weight: "3.4 lbs",
      },
      instructions: "Insert battery and use trigger",
      safetyNotes: "Wear safety glasses",
    };

    vi.mocked(analyzeToolImage).mockResolvedValue(mockAnalysisResult);

    // Act
    const result = await analyzeToolImageAction(mockImageUrls);

    // Assert
    expect(result).toEqual({
      success: true,
      data: mockAnalysisResult,
    });
    expect(analyzeToolImage).toHaveBeenCalledWith(mockImageUrls);
  });

  it("should handle single image URL as string", async () => {
    // Arrange
    const { analyzeToolImage } =
      await import("@/services/openai/analyze-tool-image");
    const mockImageUrl = "https://example.com/image1.jpg";
    const mockAnalysisResult = {
      name: "Hammer",
      description: "A heavy hammer",
      categoryName: "Hand Tools",
      brand: null,
      model: null,
      condition: "excellent" as const,
      specifications: {},
      instructions: null,
      safetyNotes: null,
    };

    vi.mocked(analyzeToolImage).mockResolvedValue(mockAnalysisResult);

    // Act
    const result = await analyzeToolImageAction(mockImageUrl);

    // Assert
    expect(result).toEqual({
      success: true,
      data: mockAnalysisResult,
    });
    expect(analyzeToolImage).toHaveBeenCalledWith([mockImageUrl]);
  });

  it("should handle multiple image URLs as array", async () => {
    // Arrange
    const { analyzeToolImage } =
      await import("@/services/openai/analyze-tool-image");
    const mockImageUrls = [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg",
    ];
    const mockAnalysisResult = {
      name: "Ladder",
      description: "An extendable ladder",
      categoryName: "Ladders & Access",
      brand: "Little Giant",
      model: "Velocity",
      condition: "good" as const,
      specifications: {
        weight: "25 lbs",
        dimensions: "6-10 ft",
      },
      instructions: "Extend carefully",
      safetyNotes: "Do not overextend",
    };

    vi.mocked(analyzeToolImage).mockResolvedValue(mockAnalysisResult);

    // Act
    const result = await analyzeToolImageAction(mockImageUrls);

    // Assert
    expect(result).toEqual({
      success: true,
      data: mockAnalysisResult,
    });
    expect(analyzeToolImage).toHaveBeenCalledWith(mockImageUrls);
  });

  it("should return error when analysis fails with Error instance", async () => {
    // Arrange
    const { analyzeToolImage } =
      await import("@/services/openai/analyze-tool-image");
    const mockImageUrls = ["https://example.com/image1.jpg"];
    const mockError = new Error(
      "Failed to analyze image: Invalid image format",
    );

    vi.mocked(analyzeToolImage).mockRejectedValue(mockError);

    // Act
    const result = await analyzeToolImageAction(mockImageUrls);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Failed to analyze image: Invalid image format",
    });
    expect(analyzeToolImage).toHaveBeenCalledWith(mockImageUrls);
  });

  it("should return error when analysis fails with non-Error value", async () => {
    // Arrange
    const { analyzeToolImage } =
      await import("@/services/openai/analyze-tool-image");
    const mockImageUrls = ["https://example.com/image1.jpg"];
    const mockError = "API rate limit exceeded";

    vi.mocked(analyzeToolImage).mockRejectedValue(mockError);

    // Act
    const result = await analyzeToolImageAction(mockImageUrls);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Analysis failed",
    });
    expect(analyzeToolImage).toHaveBeenCalledWith(mockImageUrls);
  });

  it("should return error when no tool detected", async () => {
    // Arrange
    const { analyzeToolImage } =
      await import("@/services/openai/analyze-tool-image");
    const mockImageUrls = ["https://example.com/landscape.jpg"];
    const mockError = new Error("No tool detected in the image");

    vi.mocked(analyzeToolImage).mockRejectedValue(mockError);

    // Act
    const result = await analyzeToolImageAction(mockImageUrls);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "No tool detected in the image",
    });
    expect(analyzeToolImage).toHaveBeenCalledWith(mockImageUrls);
  });

  it("should return error when image processing fails", async () => {
    // Arrange
    const { analyzeToolImage } =
      await import("@/services/openai/analyze-tool-image");
    const mockImageUrls = ["https://example.com/corrupted.jpg"];
    const mockError = new Error("Image processing failed: corrupted file");

    vi.mocked(analyzeToolImage).mockRejectedValue(mockError);

    // Act
    const result = await analyzeToolImageAction(mockImageUrls);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Image processing failed: corrupted file",
    });
    expect(analyzeToolImage).toHaveBeenCalledWith(mockImageUrls);
  });

  it("should handle multiple tools in image", async () => {
    // Arrange
    const { analyzeToolImage } =
      await import("@/services/openai/analyze-tool-image");
    const mockImageUrls = ["https://example.com/toolbox.jpg"];
    const mockAnalysisResult = {
      name: "Toolbox with Multiple Tools",
      description: "A toolbox containing various hand tools",
      categoryName: "Hand Tools",
      brand: "Craftsman",
      model: null,
      condition: "good" as const,
      specifications: {
        weight: "15 lbs",
        material: "plastic and metal",
      },
      instructions: "Contains hammers, screwdrivers, and wrenches",
      safetyNotes: "Keep children away from sharp tools",
    };

    vi.mocked(analyzeToolImage).mockResolvedValue(mockAnalysisResult);

    // Act
    const result = await analyzeToolImageAction(mockImageUrls);

    // Assert
    expect(result).toEqual({
      success: true,
      data: mockAnalysisResult,
    });
    expect(analyzeToolImage).toHaveBeenCalledWith(mockImageUrls);
  });
});
