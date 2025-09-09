export function formatReviewSummary(average: number, count: number): string {
  if (count === 0) return "No reviews yet";
  return `${average} (${count} review${count === 1 ? "" : "s"})`;
}
