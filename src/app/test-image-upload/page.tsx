"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyzeToolImageAction } from "@/lib/actions/analyze-tool-image";
import { X } from "lucide-react";

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

interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

export default function TestImageUploadPage() {
  const [selectedImages, setSelectedImages] = useState<ImageFile[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  };

  const removeImage = (id: string) => {
    setSelectedImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
    setUploadedUrls([]); // Clear uploaded URLs when images change
    setAnalysis(null); // Clear analysis when images change
  };

  const handleUpload = async () => {
    if (selectedImages.length === 0) {
      setError("Please select at least one image");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const uploadPromises = selectedImages.map(async (imageFile) => {
        const formData = new FormData();
        formData.append("file", imageFile.file);

        const response = await fetch("/api/test-upload", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Upload failed");
        }

        return result.url;
      });

      const urls = await Promise.all(uploadPromises);
      setUploadedUrls(urls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (uploadedUrls.length === 0) {
      setError("Please upload images first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Starting analysis for URLs:", uploadedUrls);
      const result = await analyzeToolImageAction(uploadedUrls);
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
                possible
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

            <Button
              onClick={handleUpload}
              disabled={selectedImages.length === 0 || loading}
              className="w-full"
            >
              {loading
                ? "Uploading..."
                : `Upload ${selectedImages.length} Image${selectedImages.length !== 1 ? "s" : ""} to Vercel Blob`}
            </Button>

            {uploadedUrls.length > 0 && (
              <div className="mt-4">
                <Label>Uploaded Images:</Label>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {uploadedUrls.map((url, index) => (
                    <div key={index} className="flex flex-col">
                      <img
                        src={url}
                        alt={`Uploaded ${index + 1}`}
                        className="h-32 w-full rounded border object-cover"
                      />
                      <p className="mt-1 truncate text-xs text-gray-500">
                        Image {index + 1}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              disabled={uploadedUrls.length === 0 || loading}
              className="w-full"
            >
              {loading
                ? "Analyzing..."
                : `Analyze ${uploadedUrls.length} Image${uploadedUrls.length !== 1 ? "s" : ""} with OpenAI`}
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
