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
