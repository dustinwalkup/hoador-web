import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface ToolImage {
  id: string;
  toolId: string;
  imageUrl: string;
  blobPathname: string;
  orderIndex: number;
  createdAt: Date;
}

export function useToolImages(toolId: string) {
  const [images, setImages] = useState<ToolImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadImages = useCallback(async () => {
    if (!toolId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools/${toolId}/images`);
      const result = await response.json();

      if (result.success) {
        setImages(result.images);
      } else {
        toast.error(result.error || "Failed to load images");
      }
    } catch (error) {
      console.error("Load images failed", error);
      toast.error("Failed to load images");
    } finally {
      setIsLoading(false);
    }
  }, [toolId]);

  const uploadImage = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/tools/${toolId}/images`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setImages((prev) => [...prev, result.image]);
        toast.success("Image uploaded successfully");
        return result.image;
      } else {
        toast.error(result.error || "Upload failed");
        return null;
      }
    } catch (error) {
      toast.error("Upload failed");
      console.error("Upload failed", error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteImage = async (imageId: string) => {
    try {
      const response = await fetch(`/api/tools/${toolId}/images/${imageId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        toast.success("Image deleted successfully");
      } else {
        toast.error(result.error || "Delete failed");
      }
    } catch (error) {
      toast.error("Delete failed");
      console.error("Delete failed", error);
    }
  };

  const reorderImages = async (newImageIds: string[]) => {
    try {
      const response = await fetch(`/api/tools/${toolId}/images/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: newImageIds }),
      });

      const result = await response.json();

      if (result.success) {
        // Update local state to reflect new order
        const reorderedImages = newImageIds.map((id, index) => {
          const image = images.find((img) => img.id === id)!;
          return { ...image, orderIndex: index };
        });
        setImages(reorderedImages);
        toast.success("Images reordered successfully");
      } else {
        toast.error(result.error || "Reorder failed");
      }
    } catch (error) {
      toast.error("Reorder failed");
      console.error("Reorder failed", error);
    }
  };

  return {
    images,
    setImages,
    loadImages,
    uploadImage,
    deleteImage,
    reorderImages,
    isUploading,
    isLoading,
  };
}
