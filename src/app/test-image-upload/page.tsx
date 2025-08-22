"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { analyzeToolImageAction } from "@/lib/actions/analyze-tool-image";
import {
  X,
  Search,
  ExternalLink,
  Star,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Info,
} from "lucide-react";

interface AnalysisResult {
  name: string;
  description: string;
  categoryName: string;
  brand: string | null;
  model: string | null;
  condition: string;
  specifications: {
    power?: string;
    weight?: string;
    dimensions?: string;
    material?: string;
  };
  instructions: string;
  safetyNotes: string;
}

interface Product {
  title: string;
  price: string | number | null;
  link: string;
  source?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  relevanceScore?: number;
}

interface PriceAnalysis {
  lowest: number;
  highest: number;
  median: number;
  average: number;
  pricePoints: number;
  sources: Array<{
    source: string;
    price: number;
    rating?: number;
    reviews?: number;
  }>;
}

interface ToolMatchResult {
  bestMatch: Product | null;
  alternativeMatches: Product[];
  priceAnalysis: PriceAnalysis | null;
  confidence: number;
  searchMetadata: {
    originalQuery: string;
    totalResults: number;
    topScores: number[];
    engine: string;
  };
  // Legacy fields for backward compatibility
  products: Product[];
  searchQuery: string;
  engine: string;
}

interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

export default function TestImageUploadPage() {
  const [selectedImages, setSelectedImages] = useState<ImageFile[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toolMatchResult, setToolMatchResult] =
    useState<ToolMatchResult | null>(null);
  const [serpLoading, setSerpLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const hasSearchedRef = useRef(false);

  // Automatically trigger SerpAPI search when analysis is complete
  useEffect(() => {
    if (analysis && !hasSearchedRef.current) {
      hasSearchedRef.current = true;
      handleSerpSearch();
    }
  }, [analysis]);

  const handleSerpSearch = async () => {
    if (!analysis) return;

    try {
      setSerpLoading(true);
      setError(null);

      // Build search parameters from analysis data
      const params = new URLSearchParams();
      if (analysis.name) params.append("name", analysis.name);
      if (analysis.categoryName)
        params.append("category", analysis.categoryName);
      if (analysis.brand) params.append("brand", analysis.brand);
      if (analysis.model) params.append("model", analysis.model);

      const res = await fetch(`/api/test-serp?${params.toString()}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      setToolMatchResult(data);
      setSearchQuery(data.searchQuery || "");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "SerpApi search failed";
      setError(errorMessage);
    } finally {
      setSerpLoading(false);
    }
  };

  const handleManualSerpSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a search term");
      return;
    }

    try {
      setSerpLoading(true);
      setError(null);

      // Use the manual search query instead of analysis data
      const params = new URLSearchParams();
      params.append("name", searchQuery.trim());

      const res = await fetch(`/api/test-serp?${params.toString()}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      setToolMatchResult(data);
      // Keep the manual search query, don't override it
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "SerpApi search failed";
      setError(errorMessage);
    } finally {
      setSerpLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (confidence >= 60)
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 80) return <CheckCircle size={16} />;
    if (confidence >= 60) return <Info size={16} />;
    return <AlertCircle size={16} />;
  };

  const formatPrice = (price: string | number | null): string => {
    if (price === null || price === undefined) return "Price not available";
    if (typeof price === "number") return `$${price.toFixed(2)}`;
    return price.toString();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (selectedImages.length + imageFiles.length > 3) {
      setError("Maximum 3 images allowed");
      return;
    }

    const newImageFiles: ImageFile[] = imageFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
    }));

    setSelectedImages((prev) => [...prev, ...newImageFiles]);
    setError(null);

    // Reset search state when new images are added
    if (newImageFiles.length > 0) {
      setToolMatchResult(null);
      setSearchQuery("");
      hasSearchedRef.current = false;
    }
  };

  const removeImage = (id: string) => {
    setSelectedImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
    setAnalysis(null);
    setToolMatchResult(null);
    setSearchQuery("");
    hasSearchedRef.current = false;
  };

  const handleUpload = async () => {
    if (selectedImages.length === 0) {
      setError("Please select at least one image");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Upload simulation completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (selectedImages.length === 0) {
      setError("Please select images first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const imageDataUrls = await Promise.all(
        selectedImages.map(async (imageFile) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve(reader.result as string);
            };
            reader.readAsDataURL(imageFile.file);
          });
        }),
      );

      console.log("Starting analysis for images:", selectedImages.length);
      const result = await analyzeToolImageAction(imageDataUrls);
      console.log("Analysis result:", result);

      if (!result.success) {
        throw new Error(result.error || "Analysis failed");
      }

      setAnalysis(result.data);
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl">
        Image Upload & OpenAI Analysis Test
      </h1>

      <div className="grid gap-4 sm:gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Images (Max 3)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="images">Select images of the same tool</Label>
              <p className="mt-1 text-sm text-gray-600">
                Choose different angles and include make/model in clear print if
                possible. Images will be automatically optimized for web.
              </p>
              <Input
                id="images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="mt-2"
                disabled={selectedImages.length >= 3}
              />
            </div>

            {/* Image Previews */}
            {selectedImages.length > 0 && (
              <div className="space-y-3">
                <Label>Selected Images ({selectedImages.length}/3):</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedImages.map((image) => (
                    <div key={image.id} className="group relative">
                      <img
                        src={image.preview}
                        alt="Preview"
                        className="h-32 w-full rounded border object-cover"
                      />
                      <button
                        onClick={() => removeImage(image.id)}
                        className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                        type="button"
                      >
                        <X size={16} />
                      </button>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {image.file.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={selectedImages.length === 0 || loading}
                className="flex-1"
              >
                {loading
                  ? "Uploading..."
                  : `Upload ${selectedImages.length} Image${selectedImages.length !== 1 ? "s" : ""}`}
              </Button>
              {selectedImages.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    selectedImages.forEach((img) =>
                      URL.revokeObjectURL(img.preview),
                    );
                    setSelectedImages([]);
                    setAnalysis(null);
                    setToolMatchResult(null);
                    setSearchQuery("");
                    hasSearchedRef.current = false;
                    setError(null);
                  }}
                  className="flex-shrink-0"
                >
                  Clear All
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Section */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>OpenAI Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 overflow-x-hidden">
            <Button
              onClick={handleAnalyze}
              disabled={selectedImages.length === 0 || loading}
              className="w-full"
            >
              {loading
                ? "Analyzing..."
                : `Analyze ${selectedImages.length} Image${selectedImages.length !== 1 ? "s" : ""} with OpenAI`}
            </Button>

            {analysis && (
              <div className="mt-4 space-y-4">
                <h3 className="text-lg font-semibold">Analysis Results:</h3>

                <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Tool Name</Label>
                    <p className="text-sm break-words">{analysis.name}</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Category</Label>
                    <p className="text-sm break-words">
                      {analysis.categoryName}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Brand</Label>
                    <p className="text-sm break-words">
                      {analysis.brand || "Not specified"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Model</Label>
                    <p className="text-sm break-words">
                      {analysis.model || "Not specified"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Condition</Label>
                    <p className="text-sm break-words">{analysis.condition}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm leading-relaxed break-words">
                    {analysis.description}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium">Instructions</Label>
                  <p className="text-sm leading-relaxed break-words">
                    {analysis.instructions}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium">Safety Notes</Label>
                  <p className="text-sm leading-relaxed break-words">
                    {analysis.safetyNotes}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium">Specifications</Label>
                  <div className="space-y-2 text-sm">
                    {Object.entries(analysis.specifications).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:justify-between sm:space-y-0"
                        >
                          <span className="font-medium capitalize">{key}:</span>
                          <span className="break-words sm:text-right">
                            {value}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded bg-gray-50 p-3 sm:p-4">
                  <Label className="text-sm font-medium">Raw JSON:</Label>
                  <pre className="mt-2 max-h-48 overflow-auto text-xs sm:max-h-64">
                    {JSON.stringify(analysis, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Tool Matching Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Enhanced Tool Matching Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Confidence Score Display */}
            {toolMatchResult && (
              <div
                className={`rounded-lg border p-4 ${getConfidenceColor(toolMatchResult.confidence)}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  {getConfidenceIcon(toolMatchResult.confidence)}
                  <h4 className="font-medium">
                    Match Confidence: {toolMatchResult.confidence}%
                  </h4>
                </div>
                <p className="text-sm">
                  {toolMatchResult.confidence >= 80
                    ? "High confidence match - results are likely accurate"
                    : toolMatchResult.confidence >= 60
                      ? "Medium confidence - results may need verification"
                      : "Low confidence - manual verification recommended"}
                </p>
              </div>
            )}

            {/* Search Query Info */}
            {analysis && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h4 className="mb-2 font-medium text-blue-900">
                  Search Query Used:
                </h4>
                <p className="text-sm text-blue-800">
                  {searchQuery || "Building search query from analysis..."}
                </p>
                <div className="mt-2 space-y-1 text-xs text-blue-600">
                  <p>
                    <strong>Name:</strong> {analysis.name}
                  </p>
                  <p>
                    <strong>Category:</strong> {analysis.categoryName}
                  </p>
                  <p>
                    <strong>Brand:</strong> {analysis.brand || "Not specified"}
                  </p>
                  <p>
                    <strong>Model:</strong> {analysis.model || "Not specified"}
                  </p>
                </div>
                {toolMatchResult?.searchMetadata && (
                  <div className="mt-2 text-xs text-blue-600">
                    <p>
                      <strong>Total Results:</strong>{" "}
                      {toolMatchResult.searchMetadata.totalResults}
                    </p>
                    <p>
                      <strong>Top Relevance Scores:</strong>{" "}
                      {toolMatchResult.searchMetadata.topScores
                        .slice(0, 3)
                        .join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Manual Search */}
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Search for products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim() && !serpLoading) {
                    e.preventDefault();
                    handleManualSerpSearch();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={handleManualSerpSearch}
                disabled={serpLoading || !searchQuery.trim()}
                className="flex-shrink-0"
              >
                {serpLoading ? (
                  <svg
                    className="h-4 w-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <Search size={18} />
                )}
              </Button>
            </div>

            {/* Price Analysis */}
            {toolMatchResult?.priceAnalysis && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <h4 className="mb-3 flex items-center gap-2 font-medium text-green-900">
                  <TrendingUp size={16} />
                  Price Analysis ({
                    toolMatchResult.priceAnalysis.pricePoints
                  }{" "}
                  sources)
                </h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-green-700">Lowest</p>
                    <p className="font-semibold text-green-900">
                      ${toolMatchResult.priceAnalysis.lowest}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-green-700">Average</p>
                    <p className="font-semibold text-green-900">
                      ${toolMatchResult.priceAnalysis.average}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-green-700">Median</p>
                    <p className="font-semibold text-green-900">
                      ${toolMatchResult.priceAnalysis.median}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-green-700">Highest</p>
                    <p className="font-semibold text-green-900">
                      ${toolMatchResult.priceAnalysis.highest}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {serpLoading && (
              <div className="flex items-center justify-center py-8">
                <svg
                  className="h-12 w-12 animate-spin text-blue-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="ml-4 text-lg text-gray-600">
                  Analyzing and matching products...
                </p>
              </div>
            )}

            {/* Best Match */}
            {toolMatchResult?.bestMatch && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-2 font-medium text-gray-900">
                    <CheckCircle size={16} className="text-green-600" />
                    Best Match (Score:{" "}
                    {toolMatchResult.bestMatch.relevanceScore || "N/A"})
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSerpSearch}
                    disabled={serpLoading || !analysis}
                  >
                    Refresh Search
                  </Button>
                </div>

                <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        {toolMatchResult.bestMatch.thumbnail && (
                          <img
                            src={toolMatchResult.bestMatch.thumbnail}
                            alt="Product"
                            className="h-16 w-16 flex-shrink-0 rounded object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <h5 className="mb-2 line-clamp-2 font-medium text-gray-900">
                            {toolMatchResult.bestMatch.title}
                          </h5>
                          <div className="mb-2 flex items-center gap-4">
                            <p className="text-lg font-semibold text-green-600">
                              {formatPrice(toolMatchResult.bestMatch.price)}
                            </p>
                            {toolMatchResult.bestMatch.rating && (
                              <div className="flex items-center gap-1">
                                <Star
                                  size={14}
                                  className="fill-yellow-400 text-yellow-400"
                                />
                                <span className="text-sm text-gray-600">
                                  {toolMatchResult.bestMatch.rating}
                                </span>
                                {toolMatchResult.bestMatch.reviews && (
                                  <span className="text-xs text-gray-500">
                                    ({toolMatchResult.bestMatch.reviews}{" "}
                                    reviews)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {toolMatchResult.bestMatch.source ||
                                "Google Shopping"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Relevance:{" "}
                              {toolMatchResult.bestMatch.relevanceScore ||
                                "N/A"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    {toolMatchResult.bestMatch.link && (
                      <a
                        href={toolMatchResult.bestMatch.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 flex-shrink-0 rounded-md bg-blue-600 px-3 py-2 text-white transition-colors hover:bg-blue-700"
                        title="View Product"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Alternative Matches */}
            {toolMatchResult?.alternativeMatches &&
              toolMatchResult.alternativeMatches.length > 0 && (
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 font-medium text-gray-900">
                    <Users size={16} />
                    Alternative Matches (
                    {toolMatchResult.alternativeMatches.length})
                  </h4>
                  {toolMatchResult.alternativeMatches.map((product, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex flex-1 items-start gap-3">
                          {product.thumbnail && (
                            <img
                              src={product.thumbnail}
                              alt="Product"
                              className="h-12 w-12 flex-shrink-0 rounded object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h5 className="mb-1 line-clamp-2 font-medium text-gray-900">
                              {product.title}
                            </h5>
                            <div className="mb-2 flex items-center gap-3">
                              <p className="text-lg font-semibold text-green-600">
                                {formatPrice(product.price)}
                              </p>
                              {product.rating && (
                                <div className="flex items-center gap-1">
                                  <Star
                                    size={12}
                                    className="fill-yellow-400 text-yellow-400"
                                  />
                                  <span className="text-sm text-gray-600">
                                    {product.rating}
                                  </span>
                                  {product.reviews && (
                                    <span className="text-xs text-gray-500">
                                      ({product.reviews})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {product.source || "Google Shopping"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Score: {product.relevanceScore || "N/A"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {product.link && (
                          <a
                            href={product.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-4 flex-shrink-0 rounded-md bg-gray-100 p-2 transition-colors hover:bg-gray-200"
                            title="View Product"
                          >
                            <ExternalLink size={16} className="text-gray-600" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {/* No Results State */}
            {!serpLoading && !toolMatchResult?.bestMatch && analysis && (
              <div className="py-8 text-center text-gray-500">
                <Search className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <p>
                  No products found. Try adjusting your search or check the
                  analysis data.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
