import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useListingForm } from "../use-listing-form";
import type { CreateListingFormDataClientType } from "../../form-schema/listing.schema";

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: vi.fn(),
}));

// Mock zod resolver
vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: vi.fn(() => vi.fn()),
}));

// Mock constants
vi.mock("../../../constants/garage", () => ({
  getMockToolImage: vi.fn(() => "https://example.com/mock-image.jpg"),
}));

// Mock form schema
vi.mock("../../form-schema/listing.schema", () => ({
  createListingSchemaClient: {},
  type: {},
}));

// Mock React Hook Form
let mockForm: any;

const createMockForm = () => ({
  control: {},
  handleSubmit: vi.fn((handler) => (e?: any) => {
    e?.preventDefault?.();
    handler(mockForm.getValues());
  }),
  watch: vi.fn(),
  getValues: vi.fn(() => ({
    images: [],
    specifications: {},
    deliveryFee: 0,
    deliveryRadius: 0,
  })),
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
    submitCount: 0,
    isSubmitted: false,
    isSubmitSuccessful: false,
  },
});

import { useForm } from "react-hook-form";

describe("useListingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockForm = createMockForm();

    (useForm as any).mockReturnValue(mockForm);
  });

  describe("Form Initialization", () => {
    it("should initialize with default values", () => {
      renderHook(() => useListingForm());

      expect(useForm).toHaveBeenCalledWith({
        resolver: expect.any(Function),
        defaultValues: expect.objectContaining({
          name: "",
          description: "",
          categoryId: "",
          condition: "good",
          dailyRate: 0,
          securityDeposit: 0,
          images: [],
          specifications: {},
          minimumRentalPeriod: 1,
          maximumRentalPeriod: 30,
          deliveryMode: "pickup_only",
          deliveryFee: 0,
          deliveryRadius: 0,
          setupAvailable: false,
          setupFee: 0,
          ownerPoliciesAcknowledged: false,
        }),
        mode: "onTouched",
      });
    });

    it("should merge initial values with defaults", () => {
      const initialValues: Partial<CreateListingFormDataClientType> = {
        name: "Test Listing",
        dailyRate: 25,
        categoryId: "power-tools",
      };

      renderHook(() => useListingForm(initialValues));

      expect(useForm).toHaveBeenCalledWith({
        resolver: expect.any(Function),
        defaultValues: expect.objectContaining({
          name: "Test Listing",
          dailyRate: 25,
          categoryId: "power-tools",
          condition: "good", // default value
          deliveryMode: "pickup_only", // default value
        }),
        mode: "onTouched",
      });
    });
  });

  describe("Image Management", () => {
    it("should add image with file", () => {
      const { result } = renderHook(() => useListingForm());

      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "images") return [];
        return {};
      });

      act(() => {
        result.current.addImage(mockFile);
      });

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "images",
        [{ file: mockFile, orderIndex: 0, id: expect.any(String) }],
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });

    it("should add image without file (mock image)", () => {
      const { result } = renderHook(() => useListingForm());

      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "images") return [];
        return {};
      });

      act(() => {
        result.current.addImage();
      });

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "images",
        [{ url: expect.any(String), orderIndex: 0, id: expect.any(String) }],
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });

    it("should add image with correct order index", () => {
      const { result } = renderHook(() => useListingForm());

      const existingImages = [
        { file: new File([""], "img1.jpg"), orderIndex: 0 },
        { file: new File([""], "img2.jpg"), orderIndex: 1 },
      ];
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "images") return existingImages;
        return {};
      });

      act(() => {
        result.current.addImage(new File([""], "img3.jpg"));
      });

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "images",
        [
          ...existingImages,
          { file: expect.any(File), orderIndex: 2, id: expect.any(String) },
        ],
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });

    it("should remove image by index", () => {
      const { result } = renderHook(() => useListingForm());

      const images = [
        { file: new File([""], "img1.jpg"), orderIndex: 0 },
        { file: new File([""], "img2.jpg"), orderIndex: 1 },
        { file: new File([""], "img3.jpg"), orderIndex: 2 },
      ];
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "images") return images;
        return {};
      });

      act(() => {
        result.current.removeImage(1);
      });

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "images",
        [images[0], images[2]],
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });

    it("should reorder images correctly", () => {
      const { result } = renderHook(() => useListingForm());

      const images = [
        { id: "img1", orderIndex: 0 },
        { id: "img2", orderIndex: 1 },
        { id: "img3", orderIndex: 2 },
      ];
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "images") return images;
        return {};
      });

      act(() => {
        result.current.updateImageOrder(0, 2);
      });

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "images",
        [
          { id: "img2", orderIndex: 0 },
          { id: "img3", orderIndex: 1 },
          { id: "img1", orderIndex: 2 },
        ],
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });
  });

  describe("Specification Management", () => {
    it("should add specification", () => {
      const { result } = renderHook(() => useListingForm());

      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "specifications") return { power: "20V" };
        return {};
      });

      act(() => {
        result.current.addSpecification("weight", "3.4 lbs");
      });

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "specifications",
        {
          power: "20V",
          weight: "3.4 lbs",
        },
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });

    it("should not add specification with empty key or value", () => {
      const { result } = renderHook(() => useListingForm());

      act(() => {
        result.current.addSpecification("", "value");
      });

      act(() => {
        result.current.addSpecification("key", undefined as unknown as string);
      });

      act(() => {
        result.current.addSpecification("key", null as unknown as string);
      });

      expect(mockForm.setValue).not.toHaveBeenCalledWith(
        "specifications",
        expect.any(Object),
      );
    });

    it("should remove specification", () => {
      const { result } = renderHook(() => useListingForm());

      const specs = { power: "20V", weight: "3.4 lbs", chuckSize: "1/2 inch" };
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "specifications") return specs;
        return {};
      });

      act(() => {
        result.current.removeSpecification("weight");
      });

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "specifications",
        {
          power: "20V",
          chuckSize: "1/2 inch",
        },
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });
  });

  describe("Delivery Mode Handling", () => {
    it("should handle delivery mode change to pickup_only", () => {
      const { result } = renderHook(() => useListingForm());

      act(() => {
        result.current.handleDeliveryModeChange("pickup_only");
      });

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "deliveryMode",
        "pickup_only",
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });

    it("should handle delivery mode change to delivery_only", () => {
      const { result } = renderHook(() => useListingForm());

      // Mock getValues to return undefined for deliveryFee and deliveryRadius
      // so they get set to defaults
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "deliveryFee" || field === "deliveryRadius") {
          return undefined;
        }
        return {};
      });

      act(() => {
        result.current.handleDeliveryModeChange("delivery_only");
      });

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "deliveryMode",
        "delivery_only",
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
      // Should set default values for delivery fields
      expect(mockForm.setValue).toHaveBeenCalledWith("deliveryFee", 0, {
        shouldDirty: true,
        shouldValidate: true,
      });
      expect(mockForm.setValue).toHaveBeenCalledWith("deliveryRadius", 0, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });

    it("should not override existing delivery values", () => {
      const { result } = renderHook(() => useListingForm());

      // Mock getValues to return existing values for deliveryFee and deliveryRadius
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "deliveryFee") return 15;
        if (field === "deliveryRadius") return 25;
        return {};
      });

      act(() => {
        result.current.handleDeliveryModeChange("both_available");
      });

      // Should not call setValue for delivery fields since they already have values
      expect(mockForm.setValue).toHaveBeenCalledTimes(1); // Only for deliveryMode
      expect(mockForm.setValue).toHaveBeenCalledWith(
        "deliveryMode",
        "both_available",
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });
  });

  describe("Form Return Values", () => {
    it("should return all form methods and helpers", () => {
      const { result } = renderHook(() => useListingForm());

      expect(result.current).toHaveProperty("control");
      expect(result.current).toHaveProperty("handleSubmit");
      expect(result.current).toHaveProperty("watch");
      expect(result.current).toHaveProperty("getValues");
      expect(result.current).toHaveProperty("setValue");
      expect(result.current).toHaveProperty("reset");
      expect(result.current).toHaveProperty("trigger");
      expect(result.current).toHaveProperty("getFieldState");
      expect(result.current).toHaveProperty("register");
      expect(result.current).toHaveProperty("unregister");
      expect(result.current).toHaveProperty("setError");
      expect(result.current).toHaveProperty("clearErrors");
      expect(result.current).toHaveProperty("setFocus");
      expect(result.current).toHaveProperty("formState");

      // Custom helpers
      expect(result.current).toHaveProperty("addImage");
      expect(result.current).toHaveProperty("removeImage");
      expect(result.current).toHaveProperty("updateImageOrder");
      expect(result.current).toHaveProperty("addSpecification");
      expect(result.current).toHaveProperty("removeSpecification");
      expect(result.current).toHaveProperty("handleDeliveryModeChange");
    });
  });

  describe("Form Validation Integration", () => {
    it("should use zod resolver for validation", () => {
      renderHook(() => useListingForm());

      expect(useForm).toHaveBeenCalledWith(
        expect.objectContaining({
          resolver: expect.any(Function),
        }),
      );
    });

    it("should set validation mode to onTouched", () => {
      renderHook(() => useListingForm());

      expect(useForm).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "onTouched",
        }),
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty specifications object", () => {
      const { result } = renderHook(() => useListingForm());

      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "specifications") return undefined;
        return {};
      });

      act(() => {
        result.current.addSpecification("power", "20V");
      });

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "specifications",
        {
          power: "20V",
        },
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });

    it("should handle removing specification from empty object", () => {
      const { result } = renderHook(() => useListingForm());

      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "specifications") return undefined;
        return {};
      });

      act(() => {
        result.current.removeSpecification("nonexistent");
      });

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "specifications",
        {},
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });

    it("should handle reordering with invalid indices gracefully", () => {
      const { result } = renderHook(() => useListingForm());

      const images = [{ id: "img1", orderIndex: 0 }];
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "images") return images;
        return {};
      });

      act(() => {
        result.current.updateImageOrder(10, 0); // Invalid fromIndex
      });

      // Should handle gracefully without throwing
      expect(mockForm.setValue).toHaveBeenCalled();
    });
  });
});
