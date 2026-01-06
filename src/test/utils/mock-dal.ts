import { vi } from "vitest";
import type { Mock } from "vitest";

/**
 * Creates a mock DAL method that returns a resolved promise
 */
export function createMockDALMethod<T = unknown>(
  returnValue: T,
): Mock<() => Promise<T>> {
  return vi.fn().mockResolvedValue(returnValue);
}

/**
 * Creates a mock DAL method that throws an error
 */
export function createMockDALMethodError(
  error: Error,
): Mock<() => Promise<never>> {
  return vi.fn().mockRejectedValue(error);
}

/**
 * Creates a mock DAL method that returns different values based on call count
 */
export function createMockDALMethodSequence<T>(
  ...values: T[]
): Mock<() => Promise<T>> {
  const mock = vi.fn();
  values.forEach((value) => {
    mock.mockResolvedValueOnce(value);
  });
  return mock;
}

/**
 * Resets all mocks in a DAL class
 */
export function resetDALMocks(dalClass: Record<string, Mock>) {
  Object.values(dalClass).forEach((mock) => {
    if (typeof mock === "function" && "mockReset" in mock) {
      mock.mockReset();
    }
  });
}
