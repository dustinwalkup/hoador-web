// Profile image upload API response types
export interface ProfileUploadResponse {
  success: boolean;
  url: string;
  pathname: string;
  metadata: {
    originalSize: number;
    processedSize: number;
    dimensions: string;
    compressionRatio: string;
  };
}

export interface ProfileUploadError {
  success: false;
  error: string;
}

export interface ProfileDeleteResponse {
  success: boolean;
  message: string;
}

export interface ProfileDeleteError {
  success: false;
  error: string;
}
