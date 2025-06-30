"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export const BackButton = () => {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Button variant="ghost" className="mb-4 -ml-2" disabled>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={() => router.back()}
      className="mb-4 -ml-2"
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back
    </Button>
  );
};
