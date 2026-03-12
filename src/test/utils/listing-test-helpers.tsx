/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { vi } from "vitest";
import type {
  CreateListingFormDataClientType,
  ImageFile,
} from "@/features/listings/form-schema/listing.schema";
import type { ListingDetails } from "@/dal/types";

// Create a test query client with default options
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Render component with React Query provider
export function renderWithQueryClient(
  component: ReactNode,
  queryClient?: QueryClient,
): ReturnType<typeof render> {
  const client = queryClient || createTestQueryClient();

  return render(
    <QueryClientProvider client={client}>{component}</QueryClientProvider>,
  );
}

// Mock form data for testing
export function createMockFormData(): CreateListingFormDataClientType {
  return {
    name: "Test Power Drill",
    description: "A heavy-duty power drill for construction work",
    categoryId: "power-tools",
    brand: "DeWalt",
    model: "DCD777C2",
    condition: "good" as const,
    dailyRate: 15.99,
    weeklyRate: 90.0,
    monthlyRate: 300.0,
    securityDeposit: 50.0,
    specifications: {
      power: "20V MAX",
      weight: "3.4 lbs",
      chuckSize: "1/2 inch",
    },
    instructions: "Insert battery and use trigger",
    safetyNotes: "Wear safety glasses",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    deliveryMode: "pickup_only" as const,
    deliveryFee: 0,
    deliveryRadius: 0,
    setupAvailable: false,
    setupFee: 0,
    ownerPoliciesAcknowledged: true,
    images: [
      {
        file: new File([""], "drill.jpg", { type: "image/jpeg" }),
        url: "https://example.com/drill.jpg",
        orderIndex: 0,
      },
    ],
  };
}

// Create mock form data for minimal valid submission
export function createMockMinimalFormData(): CreateListingFormDataClientType {
  return {
    name: "Hammer",
    description: "A basic hammer",
    categoryId: "hand-tools",
    condition: "good" as const,
    dailyRate: 5.0,
    securityDeposit: 0,
    specifications: {},
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    deliveryMode: "pickup_only" as const,
    deliveryFee: 0,
    deliveryRadius: 0,
    setupAvailable: false,
    setupFee: 0,
    ownerPoliciesAcknowledged: true,
    images: [
      {
        file: new File([""], "hammer.jpg", { type: "image/jpeg" }),
        url: "https://example.com/hammer.jpg",
      },
    ],
  };
}

// Create mock form data with invalid data for error testing
export function createMockInvalidFormData(): CreateListingFormDataClientType {
  return {
    name: "", // Invalid: empty name
    description: "", // Invalid: empty description
    categoryId: "", // Invalid: empty category
    condition: "good" as const,
    dailyRate: -10, // Invalid: negative price
    securityDeposit: 0,
    specifications: {},
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    deliveryMode: "pickup_only" as const,
    deliveryFee: 0,
    deliveryRadius: 0,
    setupAvailable: false,
    setupFee: 0,
    ownerPoliciesAcknowledged: false, // Invalid: not acknowledged
    images: [], // Invalid: no images
  };
}

// Create mock image file for testing
export function createMockImageFile(
  name: string = "test.jpg",
  type: string = "image/jpeg",
  size: number = 1024,
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

// Create mock image file array for testing
export function createMockImageFiles(count: number = 3): ImageFile[] {
  return Array.from({ length: count }, (_, index) => ({
    file: createMockImageFile(`image${index + 1}.jpg`),
    url: `https://example.com/image${index + 1}.jpg`,
    orderIndex: index,
    id: `image-${index + 1}`,
  }));
}

// Create mock categories for testing
export function createMockCategories() {
  return [
    {
      id: "power-tools",
      name: "Power Tools",
      description: "Electric power tools",
      icon: "drill",
    },
    {
      id: "hand-tools",
      name: "Hand Tools",
      description: "Manual hand tools",
      icon: "hammer",
    },
    {
      id: "gardening",
      name: "Gardening",
      description: "Gardening tools",
      icon: "shovel",
    },
  ];
}

// Create mock listing for testing
export function createMockListing(
  overrides: Partial<ListingDetails> = {},
): ListingDetails {
  return {
    id: "listing-123",
    name: "Test Power Drill",
    description: "A heavy-duty power drill for construction work",
    owner: {
      id: "user-123",
      firstName: "John",
      lastName: "Doe",
      profileImageUrl: "https://example.com/profile.jpg",
      averageRating: 4.5,
      reviewCount: 10,
      memberSince: new Date("2024-01-01"),
      address: {
        city: "New York",
        state: "NY",
      },
    },
    category: {
      id: "power-tools",
      name: "Power Tools",
      icon: "drill",
    },
    dailyRate: 15.99,
    weeklyRate: 90.0,
    monthlyRate: 300.0,
    securityDeposit: 50.0,
    condition: "good",
    status: "available",
    specifications: {
      power: "20V MAX",
      weight: "3.4 lbs",
    },
    instructions: "Insert battery and use trigger",
    safetyNotes: "Wear safety glasses",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    deliveryMode: "pickup_only",
    deliveryFee: 0,
    deliveryRadius: 0,
    setupAvailable: false,
    setupFee: 0,
    viewCount: 0,
    favoriteCount: 0,
    images: [
      {
        id: "image-1",
        imageUrl: "https://example.com/drill.jpg",
        orderIndex: 0,
      },
    ],
    reviews: [],
    availability: [],
    averageRating: 0,
    reviewCount: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    isFavorited: false,
    ...overrides,
  };
}

// Create mock user for testing

export function createMockUser(overrides: any = {}) {
  return {
    id: "user-123",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    profileImageUrl: "https://example.com/profile.jpg",
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// Mock React Hook Form methods
// Note: This mock needs to have _subjects at the root level for useFormContext to work
export function createMockForm() {
  const mockSubjects = {
    values: { subscribe: vi.fn(), next: vi.fn() },
    array: { subscribe: vi.fn(), next: vi.fn() },
    state: { subscribe: vi.fn(), next: vi.fn() },
    watch: { subscribe: vi.fn(), next: vi.fn() },
  };

  const control = {
    register: vi.fn((name: string) => ({
      onChange: vi.fn(),
      onBlur: vi.fn(),
      ref: vi.fn(),
      name,
    })),
    unregister: vi.fn(),
    getFieldState: vi.fn(() => ({
      error: undefined,
      invalid: false,
      isDirty: false,
      isTouched: false,
    })),
    _fields: {},
    _formState: {
      errors: {},
      isDirty: false,
      dirtyFields: {},
      touchedFields: {},
      isSubmitted: false,
      isSubmitting: false,
      isValid: true,
      isValidating: false,
      submitCount: 0,
    },
    _options: {},
    _subjects: mockSubjects,
    _defaultValues: {},
    _formValues: { ownerPoliciesAcknowledged: false },
    _stateFlags: {
      action: false,
      mount: false,
      watch: false,
    },
    _removeUnmounted: vi.fn(),
    _names: {
      mount: new Set(),
      unMount: new Set(),
      array: new Set(),
      watch: new Set(),
      watchAll: false,
    },
    _state: {},
    _getWatch: vi.fn((name?: string) => {
      if (name === "ownerPoliciesAcknowledged") return false;
      return undefined;
    }),
    _updateValid: vi.fn(),
    _updateFieldArray: vi.fn(),
    _getFieldArray: vi.fn(),
    _executeSchema: vi.fn(),
    _reset: vi.fn(),
    _updateFormState: vi.fn(),
    _setDisabledField: vi.fn(),
    _getDirty: vi.fn(),
    _subscribe: vi.fn(),
  };

  // Create a mutable getValues function that can be overridden in tests
  let getValuesImpl: (field?: string) => any = (field?: string) => {
    if (field === "images") return [];
    if (field === "specifications") return {};
    if (!field) {
      // Return full form data when called without arguments
      const formData = createMockFormData();
      return { ...formData, images: [] };
    }
    return createMockFormData();
  };

  const getValuesMock = vi.fn((field?: string) => getValuesImpl(field));

  const mockFormObj = {
    control,
    // Add _subjects at root level for useFormContext
    _subjects: mockSubjects,
    handleSubmit: vi.fn((handler) => (e?: any) => {
      e?.preventDefault?.();
      const formData = getValuesMock();
      handler(formData);
    }),
    watch: vi.fn(() => {
      // Return subscription object with unsubscribe
      return {
        unsubscribe: vi.fn(),
      };
    }),
    getValues: getValuesMock,
    // Expose method to update getValues implementation
    _updateGetValues: (impl: (field?: string) => any) => {
      getValuesImpl = impl;
    },
    setValue: vi.fn(),
    reset: vi.fn(),
    trigger: vi.fn(),
    getFieldState: vi.fn(() => ({
      error: undefined,
      invalid: false,
      isDirty: false,
      isTouched: false,
    })),
    register: vi.fn(),
    unregister: vi.fn(),
    setError: vi.fn(),
    clearErrors: vi.fn(),
    setFocus: vi.fn(),
    formState: {
      errors: {},
      isSubmitting: false,
      isValid: true,
      isDirty: false,
      touchedFields: {},
      dirtyFields: {},
      isValidating: false,
      submitCount: 0,
      isSubmitted: false,
      isSubmitSuccessful: false,
    },
    addImage: vi.fn(),
    removeImage: vi.fn(),
    setImages: vi.fn(),
    addSpecification: vi.fn(),
    removeSpecification: vi.fn(),
  };

  // Make getValues mockable
  Object.defineProperty(mockFormObj, "getValues", {
    get: () => getValuesMock,
    set: (impl: (field?: string) => any) => {
      getValuesImpl = impl;
    },
  });

  return mockFormObj;
}

// Mock router for testing
export function createMockRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
}

// Mock toast notifications
export function mockToast() {
  const mockToastFn = vi.fn();

  // Don't call vi.mock inside the function - let tests handle mocking
  // This function just returns a mock function for manual mocking
  return mockToastFn;
}

// Mock fetch for API calls
export function mockFetch(response: any = {}, status: number = 200) {
  const mockResponse = {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(response),
    text: vi.fn().mockResolvedValue(JSON.stringify(response)),
  };

  global.fetch = vi.fn().mockResolvedValue(mockResponse);
  return global.fetch as any;
}

// Mock URL state for testing
export function createMockURLState(initialState: Record<string, any> = {}) {
  return {
    state: initialState,
    updateState: vi.fn(),
  };
}

// Wait for next tick in tests
export function waitForNextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Create mock event for form interactions
export function createMockChangeEvent(value: string) {
  return {
    target: { value },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as any;
}

// Create mock submit event
export function createMockSubmitEvent() {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as any;
}
