"use client";

import { Component, Suspense, type ReactNode } from "react";

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

class WidgetErrorBoundary extends Component<
  ErrorBoundaryProps,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[Dashboard] Widget crashed:", error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/**
 * Isolates a dashboard widget: Suspense for loading, ErrorBoundary for crashes.
 * A widget throwing renders `errorFallback` (or nothing) instead of breaking
 * the whole route.
 */
export function WidgetBoundary({
  children,
  skeleton,
  errorFallback = null,
}: {
  children: ReactNode;
  skeleton: ReactNode;
  errorFallback?: ReactNode;
}) {
  return (
    <WidgetErrorBoundary fallback={errorFallback}>
      <Suspense fallback={skeleton}>{children}</Suspense>
    </WidgetErrorBoundary>
  );
}
