import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class values into a single string
 * @param inputs - The class values to combine
 * @returns The combined class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Capitalizes the first letter of a word and makes the rest of the word lowercase
 * @param word - The word to capitalize
 * @returns The capitalized word
 */
export function capitalize(word: string) {
  if (!word) return "";
  return word[0].toUpperCase() + word.substring(1).toLowerCase();
}

/**
 * Formats a numeric phone string into (XXX) XXX-XXXX
 * @param value - The raw phone string (may contain non-digit characters)
 * @returns The formatted phone number string
 */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length < 4) return digits;
  if (digits.length < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}
