/**
 * Creates a FormData object with the provided fields
 */
export function createFormData(fields: Record<string, string | File>): FormData {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

/**
 * Creates a FormData object for listing creation
 */
export function createListingFormData(overrides?: Partial<Record<string, string>>): FormData {
  return createFormData({
    name: "Test Listing",
    description: "Test description",
    categoryId: "category-123",
    dailyRate: "15.00",
    condition: "excellent",
    ...overrides,
  });
}

/**
 * Creates a FormData object for rental request creation
 */
export function createRentalRequestFormData(
  overrides?: Partial<Record<string, string>>,
): FormData {
  return createFormData({
    listingId: "listing-123",
    startDate: "2024-02-01",
    endDate: "2024-02-05",
    deliveryRequested: "false",
    setupRequested: "false",
    ...overrides,
  });
}

/**
 * Creates a FormData object for user profile update
 */
export function createProfileUpdateFormData(
  overrides?: Partial<Record<string, string>>,
): FormData {
  return createFormData({
    firstName: "John",
    lastName: "Doe",
    phone: "5551234567",
    ...overrides,
  });
}

