/**
 * Card brand utility functions
 * Handles formatting and styling for payment card brands
 */

/**
 * Normalize card brand string to lowercase
 */
export function normalizeCardBrand(brand: string): string {
  return brand.toLowerCase().trim();
}

/**
 * Get display name for card brand
 */
export function getCardBrandDisplayName(brand: string): string {
  const normalized = normalizeCardBrand(brand);

  const brandMap: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
    diners: "Diners Club",
    jcb: "JCB",
    unionpay: "UnionPay",
    elo: "Elo",
  };

  return brandMap[normalized] || brand.charAt(0).toUpperCase() + brand.slice(1);
}

/**
 * Get brand-specific color for styling
 * Returns Tailwind CSS color classes
 */
export function getCardBrandColor(brand: string): string {
  const normalized = normalizeCardBrand(brand);

  const colorMap: Record<string, string> = {
    visa: "text-[#1434CB]", // Visa blue
    mastercard: "text-[#EB001B]", // Mastercard red
    amex: "text-[#006FCF]", // American Express blue
    discover: "text-[#FF6000]", // Discover orange
    diners: "text-[#0079BE]", // Diners Club blue
    jcb: "text-[#0B4EA2]", // JCB blue
    unionpay: "text-[#E21836]", // UnionPay red
    elo: "text-[#FFCB05]", // Elo yellow/gold
  };

  return colorMap[normalized] || "text-muted-foreground";
}

/**
 * Get brand-specific background color for styling
 * Returns Tailwind CSS color classes
 */
export function getCardBrandBgColor(brand: string): string {
  const normalized = normalizeCardBrand(brand);

  const bgColorMap: Record<string, string> = {
    visa: "bg-[#1434CB]/10",
    mastercard: "bg-[#EB001B]/10",
    amex: "bg-[#006FCF]/10",
    discover: "bg-[#FF6000]/10",
    diners: "bg-[#0079BE]/10",
    jcb: "bg-[#0B4EA2]/10",
    unionpay: "bg-[#E21836]/10",
    elo: "bg-[#FFCB05]/10",
  };

  return bgColorMap[normalized] || "bg-muted";
}

/**
 * Check if a brand is supported
 */
export function isSupportedBrand(brand: string): boolean {
  const normalized = normalizeCardBrand(brand);
  const supportedBrands = [
    "visa",
    "mastercard",
    "amex",
    "discover",
    "diners",
    "jcb",
    "unionpay",
    "elo",
  ];
  return supportedBrands.includes(normalized);
}
