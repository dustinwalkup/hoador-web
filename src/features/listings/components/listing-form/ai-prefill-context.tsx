"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import { type AiPrefilledFieldKey } from "@/features/listings/ai-listing-assistant/types";

interface AiPrefillContextValue {
  prefilledFields: ReadonlySet<AiPrefilledFieldKey>;
}

const AiPrefillContext = createContext<AiPrefillContextValue | null>(null);

/**
 * Returns the AI prefill context when the form is mounted under an
 * `AiPrefillProvider`, or `null` for the manual flow. Callers should treat
 * `null` as "no AI prefill happened" so the manual form renders unchanged.
 */
export function useAiPrefill(): AiPrefillContextValue | null {
  return useContext(AiPrefillContext);
}

interface AiPrefillProviderProps {
  prefilledFields: ReadonlySet<AiPrefilledFieldKey>;
  children: ReactNode;
}

export function AiPrefillProvider({
  prefilledFields,
  children,
}: AiPrefillProviderProps) {
  const value = useMemo(() => ({ prefilledFields }), [prefilledFields]);
  return (
    <AiPrefillContext.Provider value={value}>
      {children}
    </AiPrefillContext.Provider>
  );
}
