"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const DEFAULT_MESSAGE = `We haven't seen you on Hoador in a while. There are tools in your community waiting to be shared or rented.

Log in to your dashboard to browse listings or manage your garage.`;

export interface ReengagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (
    message: string,
    channels: { email: boolean; push: boolean },
  ) => Promise<void>;
}

/**
 * Dialog for sending re-engagement notifications to selected users.
 * Supports editable message and channel selection (email, push, or both).
 */
export function ReengagementDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: ReengagementDialogProps) {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email && !push) return;
    setIsSubmitting(true);
    try {
      await onConfirm(message.trim(), { email, push });
      onOpenChange(false);
      setMessage(DEFAULT_MESSAGE);
      setEmail(true);
      setPush(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send re-engagement</DialogTitle>
          <DialogDescription>
            {selectedCount} user{selectedCount === 1 ? "" : "s"} will receive
            this message. Choose email, push, or both.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reengagement-message">Message</Label>
            <Textarea
              id="reengagement-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="resize-none"
              placeholder="We haven't seen you on Hoador..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Channels</Label>
            <div className="flex gap-6">
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={email}
                  onCheckedChange={(v) => setEmail(v === true)}
                />
                <span className="text-sm">Email</span>
              </Label>
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={push}
                  onCheckedChange={(v) => setPush(v === true)}
                />
                <span className="text-sm">Push notification</span>
              </Label>
            </div>
            {!email && !push && (
              <p className="text-destructive text-xs">
                Select at least one channel.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || (!email && !push)}
          >
            {isSubmitting ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
