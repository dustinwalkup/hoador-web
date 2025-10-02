"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const BackButton = ({ href }: { href?: string }) => {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };
  if (!isMounted) {
    return (
      <Button variant="ghost" className="-ml-2" disabled>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
    );
  }

  return (
    <Button variant="ghost" onClick={handleClick} className="mb-4 -ml-2">
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back
    </Button>
  );
};
