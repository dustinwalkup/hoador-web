"use client";

import { useEffect } from "react";

export function ScrollToTop() {
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  return null;
}
