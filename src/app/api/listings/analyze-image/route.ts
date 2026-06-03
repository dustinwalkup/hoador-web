import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listingDAL } from "@/dal";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { CANONICAL_CONDITION_ENUM } from "@/features/listings/ai-listing-assistant/types";
import { consume, refund } from "@/lib/api/ai-rate-limit";
import {
  handleApiError,
  parseFormData,
  requireAuthResponse,
} from "@/lib/api/route-helpers";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { getLogger } from "@/lib/logger";
import { analyzeListingImage } from "@/services/openai/analyze-listing-image";
import { resolveAiDraft } from "@/services/openai/resolve-ai-draft";

const analyzeImageSchema = z.object({
  imageUrls: z.union([z.string(), z.array(z.string())]),
});

/**
 * POST /api/listings/analyze-image
 *
 * Analyze staged listing photos with gpt-4o and return an `AiDraft` ready for
 * the listing form. Returns `data: null` when the model could not produce a
 * parseable response — the client maps that to a `low_confidence` failure.
 */
async function postHandler(request: NextRequest) {
  let consumedUserId: string | null = null;
  let photoCount = 0;
  let rateLimitTokensRemaining: number | null = null;
  let parseSucceeded = false;
  let categoryResolved = false;
  let conditionResolved = false;
  let outcome: "success" | "low_confidence" | "rate_limited" | "error" =
    "error";
  const startedAt = Date.now();

  try {
    const authCheck = await requireAuthResponse();
    if (authCheck) return authCheck;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const rateLimit = consume(userId);
    rateLimitTokensRemaining = rateLimit.remaining;
    if (!rateLimit.allowed) {
      outcome = "rate_limited";
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    consumedUserId = userId;

    const body = await parseFormData(request);
    const validationResult = analyzeImageSchema.safeParse(body);
    if (!validationResult.success) {
      refund(consumedUserId);
      consumedUserId = null;
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    photoCount = Array.isArray(validationResult.data.imageUrls)
      ? validationResult.data.imageUrls.length
      : 1;

    const categories = await listingDAL.getListingCategories();
    const categoryNames = categories.map((c) => c.name);

    const raw = await analyzeListingImage(validationResult.data.imageUrls, {
      categoryNames,
      conditionEnum: CANONICAL_CONDITION_ENUM,
    });

    const draft = resolveAiDraft(raw, categories);
    parseSucceeded = draft !== null;
    categoryResolved = draft !== null && draft.categoryId !== null;
    conditionResolved = draft !== null && draft.condition !== null;

    // Treat both unparseable responses and low-signal drafts (no name AND no
    // resolved category) as `low_confidence` — clients map `data: null` to the
    // failure flow. Failed calls do not eat quota.
    if (draft === null || (draft.name === null && draft.categoryId === null)) {
      refund(consumedUserId);
      consumedUserId = null;
      outcome = "low_confidence";
      return NextResponse.json({ success: true, data: null });
    }

    outcome = "success";
    return NextResponse.json({ success: true, data: draft });
  } catch (error) {
    if (consumedUserId) {
      refund(consumedUserId);
    }
    return handleApiError(error);
  } finally {
    // Always log so we can attribute per-request latency, parse outcomes,
    // and remaining quota even on the failure paths (Req 9.4 / 12.2).
    getLogger().info(
      {
        event: "ai_analyze_request",
        userId: consumedUserId,
        photoCount,
        latencyMs: Date.now() - startedAt,
        rateLimitTokensRemaining,
        parseSucceeded,
        categoryResolved,
        conditionResolved,
        outcome,
      },
      "ai_analyze_request",
    );
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/listings/analyze-image",
);
