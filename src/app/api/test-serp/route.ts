// app/api/test-serp/route.ts
import { NextRequest, NextResponse } from "next/server";

interface Product {
  title: string;
  price: string | number | null;
  link: string;
  source?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  relevanceScore?: number;
}

interface GoogleShoppingResult {
  title: string;
  extracted_price?: number;
  price?: string;
  link: string;
  source?: string;
  thumbnail?: string;
  serpapi_thumbnail?: string;
  product_link?: string;
  url?: string;
  product_url?: string;
  merchant_link?: string;
  offer_link?: string;
  rating?: number;
  reviews?: number;
  snippet?: string;
  shopping_results?: GoogleShoppingResult[];
  [key: string]: string | number | boolean | undefined | GoogleShoppingResult[];
}

interface GenericProductResult {
  title: string;
  price: string | number | null;
  link: string;
}

interface PriceAnalysis {
  lowest: number;
  highest: number;
  median: number;
  average: number;
  pricePoints: number;
  sources: Array<{
    source: string;
    price: number;
    rating?: number;
    reviews?: number;
  }>;
}

interface ToolMatchResult {
  bestMatch: Product | null;
  alternativeMatches: Product[];
  priceAnalysis: PriceAnalysis | null;
  confidence: number;
  searchMetadata: {
    originalQuery: string;
    totalResults: number;
    topScores: number[];
    engine: string;
  };
}

// Simple function to get the best available link
function getBestLink(
  product: GoogleShoppingResult,
  fallback: string = "",
): string {
  // Try product_link first, then link, then fallback
  return product.product_link || product.link || fallback;
}

// Enhanced scoring function for any type of tool
function scoreProduct(
  product: GoogleShoppingResult,
  originalQuery: string,
): number {
  let score = 0;
  const title = product.title.toLowerCase();
  const query = originalQuery.toLowerCase();

  // Extract key terms from query
  const queryTerms = query.split(/\s+/).filter((term) => term.length > 2);

  // Brand matching (universal for all tools)
  const commonBrands = [
    "ryobi",
    "dewalt",
    "milwaukee",
    "makita",
    "bosch",
    "craftsman",
    "porter",
    "cable",
    "black",
    "decker",
    "husqvarna",
    "echo",
    "stihl",
    "honda",
    "craftsman",
    "werner",
    "little",
    "giant",
    "stanley",
    "kobalt",
    "ridgid",
    "worx",
    "greenworks",
  ];

  const brandTerms = queryTerms.filter((term) => commonBrands.includes(term));
  brandTerms.forEach((brand) => {
    if (title.includes(brand)) score += 10;
  });

  // Model number exact match (universal)
  const modelNumbers = queryTerms.filter((term) =>
    /^[a-z]{2,4}\d{2,4}[a-z]?$/i.test(term),
  );

  // Product variations handling (moved up for use in model scoring)
  const hasToolOnly =
    title.includes("tool only") || title.includes("(tool only)");
  const hasKit = title.includes("kit");
  const hasCombo = title.includes("combo");

  modelNumbers.forEach((model) => {
    if (title.includes(model.toLowerCase())) {
      let modelScore = 12;

      // If model matches but it's a kit when we don't want kits, reduce score
      if (hasKit && !query.includes("kit")) {
        modelScore = Math.max(3, modelScore - 5);
      }

      score += modelScore;
    }
  });

  // Generic term matching - each query word that appears in title gets points
  const relevantTerms = queryTerms.filter(
    (term) =>
      !["the", "and", "with", "for", "tool", "only", "new", "used"].includes(
        term,
      ),
  );

  relevantTerms.forEach((term) => {
    if (title.includes(term)) {
      // Give higher score for longer, more specific terms
      const termScore = term.length >= 5 ? 8 : 6;
      score += termScore;
    }
  });

  // Measurements matching (universal - could be drill bits, saw blades, ladder height, etc.)
  const measurements = query.match(
    /\d+[\/.]*\d*\s*(in|inch|ft|feet|mm|cm|gal|gallon|hp|oz)/gi,
  );
  if (measurements) {
    measurements.forEach((measurement) => {
      const normalizedMeasurement = measurement
        .toLowerCase()
        .replace(/inch/g, "in")
        .replace(/feet/g, "ft")
        .replace(/gallon/g, "gal");
      if (title.includes(normalizedMeasurement)) {
        score += 8; // Specifications are important for any tool
      }
    });
  }

  // Voltage matching (for power tools, battery lawn equipment, etc.)
  const voltageMatch = query.match(/(\d+)v/i);
  if (voltageMatch) {
    const voltage = voltageMatch[1];
    if (title.includes(`${voltage}v`) || title.includes(`${voltage} v`)) {
      score += 6;
    }
  }

  // Universal product variation handling
  if (query.includes("tool only") && hasToolOnly) {
    score += 8;
  }

  if (title.includes("(tool only)")) {
    score += 4; // Bonus for explicit designation
  }

  // Penalize unwanted variations
  if (!query.includes("kit") && hasKit) {
    score -= 6;
  }

  if (!query.includes("combo") && hasCombo) {
    score -= 4;
  }

  // Cordless preference (applies to many tool categories now)
  if (
    title.includes("cordless") &&
    (query.includes("cordless") || voltageMatch)
  ) {
    score += 4;
  }

  // Title similarity boost
  const titleWords = title.split(/\s+/);
  const matchingWords = queryTerms.filter((term) =>
    titleWords.some((word) => word.includes(term) || term.includes(word)),
  );
  score += matchingWords.length * 2;

  // Quality indicators (universal)
  if (product.rating && product.rating >= 4.5) score += 3;
  else if (product.rating && product.rating >= 4.0) score += 2;

  if (product.reviews && product.reviews >= 100) score += 2;
  else if (product.reviews && product.reviews >= 10) score += 1;

  // Penalize products that seem off-topic
  const essentialTermsMatched = queryTerms.filter(
    (term) =>
      title.includes(term) &&
      !["the", "and", "with", "for", "tool", "only"].includes(term),
  ).length;

  if (essentialTermsMatched < queryTerms.length * 0.4) {
    score -= 8; // Penalty for poor relevance
  }

  return Math.max(0, score);
}

// Price analysis function
function aggregatePrices(products: Product[]): PriceAnalysis | null {
  const validPrices = products
    .filter((p) => typeof p.price === "number" && p.price > 0)
    .map((p) => p.price as number)
    .sort((a, b) => a - b);

  if (validPrices.length === 0) return null;

  return {
    lowest: validPrices[0],
    highest: validPrices[validPrices.length - 1],
    median: validPrices[Math.floor(validPrices.length / 2)],
    average:
      Math.round(
        (validPrices.reduce((a, b) => a + b) / validPrices.length) * 100,
      ) / 100,
    pricePoints: validPrices.length,
    sources: products
      .filter((p) => typeof p.price === "number" && p.price > 0)
      .map((p) => ({
        source: p.source || "Unknown",
        price: p.price as number,
        rating: p.rating,
        reviews: p.reviews,
      })),
  };
}

// Confidence assessment
function assessMatchConfidence(
  bestMatch: Product | null,
  alternativeMatches: Product[],
  priceAnalysis: PriceAnalysis | null,
): number {
  let confidence = 0;

  if (!bestMatch) return 0;

  // High relevance score = high confidence
  if (bestMatch.relevanceScore && bestMatch.relevanceScore >= 15)
    confidence += 40;
  else if (bestMatch.relevanceScore && bestMatch.relevanceScore >= 10)
    confidence += 25;
  else if (bestMatch.relevanceScore && bestMatch.relevanceScore >= 5)
    confidence += 10;

  // Multiple similar results = higher confidence
  if (alternativeMatches.length >= 2) confidence += 20;

  // Consistent pricing across sources = higher confidence
  if (priceAnalysis?.pricePoints && priceAnalysis.pricePoints >= 2) {
    const priceVariation =
      (priceAnalysis.highest - priceAnalysis.lowest) / priceAnalysis.average;
    if (priceVariation < 0.3)
      confidence += 25; // Prices within 30%
    else if (priceVariation < 0.5) confidence += 15;
  }

  // Good ratings = slight confidence boost
  if (bestMatch.rating && bestMatch.rating >= 4.0) confidence += 10;

  return Math.min(100, confidence);
}

// Simplified query for fallback
function simplifyQuery(query: string): string {
  const terms = query.toLowerCase().split(/\s+/);
  const important = terms.filter(
    (term) =>
      term.length > 2 &&
      !["the", "and", "with", "for", "tool", "only"].includes(term),
  );
  return important.slice(0, 4).join(" ");
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing SERP_API_KEY" },
      { status: 500 },
    );
  }

  // Get search parameters
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const category = searchParams.get("category");
  const brand = searchParams.get("brand");
  const model = searchParams.get("model");

  // Optional override (defaults to google_shopping)
  const engine = searchParams.get("engine") || "google_shopping";

  // Build query string from available params
  let query = "";
  if (name && brand && model) {
    query = `${brand} ${model} ${name}`;
  } else if (brand && model) {
    query = `${brand} ${model}`;
    if (name) query += ` ${name}`;
    if (category) query += ` ${category}`;
  } else if (brand && name) {
    query = `${brand} ${name}`;
    if (category) query += ` ${category}`;
  } else if (name && category) {
    query = `${name} ${category}`;
    if (brand) query += ` ${brand}`;
  } else if (brand) {
    query = brand;
    if (name) query += ` ${name}`;
    if (category) query += ` ${category}`;
  } else if (name) {
    query = name;
    if (category) query += ` ${category}`;
  } else if (category) {
    query = category;
  } else {
    query = "tool"; // fallback
  }

  const originalQuery = query;

  try {
    let allProducts: Product[] = [];
    const attemptedQueries: string[] = [];

    // First attempt with "tool only" appended
    const primaryQuery = query + " tool only";
    attemptedQueries.push(primaryQuery);

    const url =
      `https://serpapi.com/search.json` +
      `?engine=${engine}` +
      `&q=${encodeURIComponent(primaryQuery)}` +
      `&gl=us&hl=en` +
      `&api_key=${apiKey}`;

    console.log("PRIMARY SEARCH URL", url);

    const res = await fetch(url);
    const data = await res.json();

    if (engine === "google_shopping") {
      // Try multiple possible result sources for Google Shopping
      let results: GoogleShoppingResult[] = [];

      if (
        data.inline_shopping_results &&
        Array.isArray(data.inline_shopping_results)
      ) {
        results = data.inline_shopping_results;
      } else if (
        data.shopping_results &&
        Array.isArray(data.shopping_results)
      ) {
        results = data.shopping_results;
      } else if (data.organic_results && Array.isArray(data.organic_results)) {
        results = data.organic_results;
      }

      console.log("Google Shopping API response:", data);

      // Convert to Product format and score
      const scoredProducts = results.map((p: GoogleShoppingResult) => {
        const link = getBestLink(
          p,
          `https://shopping.google.com/search?q=${encodeURIComponent(query)}`,
        );

        const product: Product = {
          title: p.title || "Product",
          price:
            p.extracted_price ??
            (typeof p.price === "string"
              ? parseFloat(p.price.replace(/[^\d.]/g, "")) || null
              : p.price) ??
            null,
          link: link,
          source: p.source || "Google Shopping",
          thumbnail: p.thumbnail ?? p.serpapi_thumbnail,
          rating: p.rating,
          reviews: p.reviews,
          relevanceScore: scoreProduct(p, originalQuery),
        };

        return product;
      });

      allProducts = scoredProducts;

      // If we have fewer than 3 good matches, try a fallback search
      const goodMatches = scoredProducts.filter(
        (p) => p.relevanceScore && p.relevanceScore >= 5,
      );
      if (goodMatches.length < 3 && !attemptedQueries.includes(query)) {
        console.log("Attempting fallback search with simplified query...");

        const fallbackQuery = simplifyQuery(originalQuery);
        attemptedQueries.push(fallbackQuery);

        const fallbackUrl =
          `https://serpapi.com/search.json` +
          `?engine=${engine}` +
          `&q=${encodeURIComponent(fallbackQuery)}` +
          `&gl=us&hl=en` +
          `&api_key=${apiKey}`;

        try {
          const fallbackRes = await fetch(fallbackUrl);
          const fallbackData = await fallbackRes.json();

          let fallbackResults: GoogleShoppingResult[] = [];
          if (
            fallbackData.shopping_results &&
            Array.isArray(fallbackData.shopping_results)
          ) {
            fallbackResults = fallbackData.shopping_results;
          }

          const fallbackProducts = fallbackResults.map(
            (p: GoogleShoppingResult) => {
              const link = getBestLink(
                p,
                `https://shopping.google.com/search?q=${encodeURIComponent(fallbackQuery)}`,
              );

              return {
                title: p.title || "Product",
                price: p.extracted_price ?? null,
                link: link,
                source: p.source || "Google Shopping",
                thumbnail: p.thumbnail ?? p.serpapi_thumbnail,
                rating: p.rating,
                reviews: p.reviews,
                relevanceScore: scoreProduct(p, originalQuery),
              };
            },
          );

          // Merge and deduplicate
          const combinedProducts = [...allProducts];
          fallbackProducts.forEach((fp) => {
            if (!combinedProducts.some((cp) => cp.title === fp.title)) {
              combinedProducts.push(fp);
            }
          });

          allProducts = combinedProducts;
        } catch (fallbackError) {
          console.error("Fallback search failed:", fallbackError);
        }
      }
    } else {
      // For other engines
      const results = data.products ?? [];
      allProducts = results.slice(0, 5).map((p: GenericProductResult) => ({
        title: p.title,
        price: p.price,
        link:
          p.link ||
          `https://shopping.google.com/search?q=${encodeURIComponent(query)}`,
        relevanceScore: 1, // Basic score for non-Google Shopping results
      }));
    }

    // Sort by relevance score
    allProducts.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0),
    );

    // Create enhanced result structure
    const bestMatch = allProducts[0] || null;
    const alternativeMatches = allProducts.slice(1, 4);
    const priceAnalysis = aggregatePrices(allProducts);
    const confidence = assessMatchConfidence(
      bestMatch,
      alternativeMatches,
      priceAnalysis,
    );

    const toolMatchResult: ToolMatchResult = {
      bestMatch,
      alternativeMatches,
      priceAnalysis,
      confidence,
      searchMetadata: {
        originalQuery,
        totalResults: allProducts.length,
        topScores: allProducts.slice(0, 5).map((p) => p.relevanceScore || 0),
        engine,
      },
    };

    console.log("Enhanced tool matching result:", {
      bestMatchTitle: bestMatch?.title,
      bestMatchScore: bestMatch?.relevanceScore,
      confidence,
      totalResults: allProducts.length,
      queriesAttempted: attemptedQueries,
    });

    return NextResponse.json({
      success: true,
      ...toolMatchResult,
      // Legacy format for backward compatibility
      products: allProducts.slice(0, 5),
      searchQuery: originalQuery,
      engine,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "SerpApi call failed";
    console.error("API Error:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        bestMatch: null,
        confidence: 0,
        searchMetadata: {
          originalQuery,
          totalResults: 0,
          topScores: [],
          engine,
        },
      },
      { status: 500 },
    );
  }
}
