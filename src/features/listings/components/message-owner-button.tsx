"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MessageOwnerModal } from "./message-owner-modal";

interface MessageOwnerButtonProps {
  recipientId: string;
  recipientName: string;
  listingId: string;
  listingName: string;
}

export function MessageOwnerButton({
  recipientId,
  recipientName,
  listingId,
  listingName,
}: MessageOwnerButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="w-full bg-transparent"
        size="lg"
        onClick={() => setIsModalOpen(true)}
      >
        <MessageCircle className="mr-2 h-4 w-4" />
        Message Owner
      </Button>

      <MessageOwnerModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        recipientId={recipientId}
        recipientName={recipientName}
        listingId={listingId}
        listingName={listingName}
      />
    </>
  );
}
