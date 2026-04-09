"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUploadEvidence } from "../hooks/use-upload-evidence";
import { useDispute } from "../hooks/use-dispute";
import { validateImageFile } from "@/lib/image/image.utils";
import { cn } from "@/lib/utils";
import type { DisputeStatus } from "@/dal/types";
import { formatDisputeParticipantRole } from "@/features/disputes/lib/dispute-role-label";

interface EvidenceUploadProps {
  disputeId: string;
  disputeStatus: DisputeStatus;
}

/**
 * Component for uploading evidence to a dispute
 * Supports drag-and-drop image uploads and text evidence
 * Shows evidence deadline and time remaining
 * Displays uploaded evidence list with image thumbnails
 */
export function EvidenceUpload({
  disputeId,
  disputeStatus,
}: EvidenceUploadProps) {
  const { data: dispute } = useDispute(disputeId);
  const uploadEvidence = useUploadEvidence(disputeId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [textEvidence, setTextEvidence] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  // Check if uploads are disabled
  const isResolved = disputeStatus === "resolved" || disputeStatus === "closed";
  const deadline =
    dispute?.evidenceDeadline || dispute?.additionalEvidenceDeadline;
  const isDeadlineExpired = useMemo(() => {
    if (!deadline) return false;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    return deadlineDate <= now;
  }, [deadline]);
  const isUploadDisabled = isResolved || isDeadlineExpired;

  // Calculate time remaining
  const getTimeRemaining = useCallback((deadlineDate: Date | string) => {
    const now = new Date();
    const deadline = new Date(deadlineDate);
    const diffMs = deadline.getTime() - now.getTime();

    if (diffMs <= 0) return "Expired";

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""}`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""}`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
    } else {
      return `${diffSeconds} second${diffSeconds !== 1 ? "s" : ""}`;
    }
  }, []);

  const timeRemaining = useMemo(() => {
    return deadline ? getTimeRemaining(deadline) : null;
  }, [deadline, getTimeRemaining]);

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleLabel = (role: string) =>
    formatDisputeParticipantRole(role, {
      rentalId: dispute?.rentalId,
      serviceBookingId: dispute?.serviceBookingId,
    });

  // Handle file selection
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setFileError(null);

      const file = files[0];
      const validationError = validateImageFile(file);
      if (validationError) {
        setFileError(validationError);
        return;
      }

      uploadEvidence.mutate(
        { file },
        {
          onSuccess: () => {
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          },
          onError: (error) => {
            setFileError(error.message || "Failed to upload image");
          },
        },
      );
    },
    [uploadEvidence],
  );

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
    [handleFileSelect],
  );

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  // Handle text evidence submission
  const handleTextSubmit = () => {
    if (!textEvidence.trim()) {
      setFileError("Please enter text evidence");
      return;
    }

    if (textEvidence.length < 10) {
      setFileError("Text evidence must be at least 10 characters");
      return;
    }

    setFileError(null);
    uploadEvidence.mutate(
      { text: textEvidence },
      {
        onSuccess: () => {
          setTextEvidence("");
        },
        onError: (error) => {
          setFileError(error.message || "Failed to upload text evidence");
        },
      },
    );
  };

  // Separate evidence by type
  const imageEvidence =
    dispute?.evidence?.filter((e) => e.evidenceType === "image") || [];
  const textEvidenceList =
    dispute?.evidence?.filter((e) => e.evidenceType === "text") || [];

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Evidence
          </CardTitle>
          <CardDescription>
            Add images or text to support your dispute case
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Deadline Information */}
          {deadline && (
            <Alert
              variant={isDeadlineExpired ? "destructive" : "default"}
              className={cn(
                isDeadlineExpired && "bg-red-50 dark:bg-red-950/20",
              )}
            >
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    {isDeadlineExpired
                      ? "Evidence deadline has expired"
                      : `Evidence deadline: ${formatDateTime(deadline)}`}
                  </span>
                  {timeRemaining && !isDeadlineExpired && (
                    <span className="font-medium">
                      {timeRemaining} remaining
                    </span>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {isUploadDisabled && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {isResolved
                  ? "Evidence cannot be uploaded for resolved or closed disputes"
                  : "Evidence deadline has expired. No further evidence can be uploaded."}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {fileError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}

          {/* Image Upload Section */}
          <div>
            <Label htmlFor="image-upload" className="mb-2 block">
              Upload Image
            </Label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-gray-300 dark:border-gray-700",
                isUploadDisabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                ref={fileInputRef}
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                disabled={isUploadDisabled || uploadEvidence.isPending}
                className="hidden"
              />
              <Upload className="mb-4 h-10 w-10 text-gray-400" />
              <p className="mb-2 text-sm font-medium">
                Drag and drop an image here, or click to select
              </p>
              <p className="mb-4 text-xs text-gray-500">
                Supported formats: JPEG, PNG, WebP (max 10MB)
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadDisabled || uploadEvidence.isPending}
              >
                {uploadEvidence.isPending ? "Uploading..." : "Select Image"}
              </Button>
            </div>
          </div>

          {/* Text Evidence Section */}
          <div>
            <Label htmlFor="text-evidence" className="mb-2 block">
              Add Text Evidence
            </Label>
            <div className="space-y-2">
              <Textarea
                id="text-evidence"
                placeholder="Enter text evidence or additional details..."
                value={textEvidence}
                onChange={(e) => setTextEvidence(e.target.value)}
                disabled={isUploadDisabled || uploadEvidence.isPending}
                rows={4}
                className="resize-none"
              />
              <Button
                type="button"
                onClick={handleTextSubmit}
                disabled={
                  isUploadDisabled ||
                  uploadEvidence.isPending ||
                  !textEvidence.trim()
                }
                size="sm"
              >
                {uploadEvidence.isPending
                  ? "Submitting..."
                  : "Add Text Evidence"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Evidence Display */}
      {(imageEvidence.length > 0 || textEvidenceList.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Uploaded Evidence ({dispute?.evidence?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Image Evidence */}
            {imageEvidence.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="h-4 w-4" />
                  Images ({imageEvidence.length})
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {imageEvidence.map((evidence) => (
                    <Dialog key={evidence.id}>
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="relative aspect-square overflow-hidden rounded-lg border transition-opacity hover:opacity-80"
                        >
                          <Image
                            src={evidence.content}
                            alt="Evidence image"
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Evidence Image</DialogTitle>
                        </DialogHeader>
                        <div className="relative aspect-video w-full">
                          <Image
                            src={evidence.content}
                            alt="Evidence image"
                            fill
                            className="object-contain"
                            sizes="100vw"
                          />
                        </div>
                        <div className="text-muted-foreground text-sm">
                          <p>
                            Uploaded by: {getRoleLabel(evidence.uploadedByRole)}
                          </p>
                          <p>Uploaded: {formatDateTime(evidence.uploadedAt)}</p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ))}
                </div>
              </div>
            )}

            {/* Text Evidence */}
            {textEvidenceList.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4" />
                  Text Evidence ({textEvidenceList.length})
                </h3>
                <div className="space-y-3">
                  {textEvidenceList.map((evidence) => (
                    <Card key={evidence.id}>
                      <CardContent className="pt-6">
                        <p className="mb-2 text-sm leading-relaxed whitespace-pre-wrap">
                          {evidence.content}
                        </p>
                        <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                          <span>
                            Uploaded by: {getRoleLabel(evidence.uploadedByRole)}
                          </span>
                          <span>{formatDateTime(evidence.uploadedAt)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
