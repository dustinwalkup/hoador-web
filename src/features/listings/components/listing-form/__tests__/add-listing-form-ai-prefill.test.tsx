import { render, screen } from "@testing-library/react";
import { FormProvider } from "react-hook-form";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { AddListingForm } from "../add-listing-form";
import { AdditionalDetailsSection } from "../additional-details-section";
import { AiPrefillProvider } from "../ai-prefill-context";
import { BasicInformationSection } from "../basic-information-section";
import {
  createMockCategories,
  createMockForm,
  createMockRouter,
  renderWithQueryClient,
} from "@/test/utils/listing-test-helpers";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => createMockRouter()),
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock("@/features/listings/hooks/use-listing-form", () => ({
  useListingForm: vi.fn(),
}));
vi.mock("@/features/listings/hooks/use-listing-images", () => ({
  useListingImages: vi.fn(),
}));
vi.mock("@/features/listings/hooks/use-listing-form-submit", () => ({
  useListingFormSubmit: vi.fn(),
}));

type PrefilledFieldKey =
  | "name"
  | "description"
  | "categoryId"
  | "brand"
  | "model"
  | "condition"
  | "specifications"
  | "instructions"
  | "safetyNotes";

function renderInProvider(
  ui: React.ReactNode,
  options: { prefilledFields?: ReadonlySet<PrefilledFieldKey> } = {},
) {
  if (options.prefilledFields) {
    return render(
      <AiPrefillProvider prefilledFields={options.prefilledFields}>
        {ui}
      </AiPrefillProvider>,
    );
  }
  return render(<>{ui}</>);
}

describe("AddListingForm AI-prefill primitives wired into sections", () => {
  const mockCategories = createMockCategories();
  const mockForm = createMockForm() as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("BasicInformationSection", () => {
    function renderBasic(prefilled?: ReadonlySet<PrefilledFieldKey>) {
      return renderInProvider(
        <FormProvider {...(mockForm as any)}>
          <BasicInformationSection
            control={mockForm.control as any}
            categories={mockCategories}
          />
        </FormProvider>,
        { prefilledFields: prefilled },
      );
    }

    it("renders no AI badges in the manual flow (Req 7.6 regression)", () => {
      renderBasic();
      for (const field of [
        "name",
        "description",
        "categoryId",
        "brand",
        "model",
        "condition",
      ] as const) {
        expect(
          screen.queryByTestId(`ai-suggested-badge-${field}`),
        ).not.toBeInTheDocument();
      }
    });

    it("renders only the badges for fields actually in the prefilled set", () => {
      renderBasic(new Set(["name", "categoryId", "condition"]));
      expect(screen.getByTestId("ai-suggested-badge-name")).toBeInTheDocument();
      expect(
        screen.getByTestId("ai-suggested-badge-categoryId"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("ai-suggested-badge-condition"),
      ).toBeInTheDocument();
      // Not in the set:
      expect(
        screen.queryByTestId("ai-suggested-badge-brand"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("ai-suggested-badge-model"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("ai-suggested-badge-description"),
      ).not.toBeInTheDocument();
    });

    it("renders the badge for every prefillable basic-info field when all are set", () => {
      renderBasic(
        new Set([
          "name",
          "description",
          "categoryId",
          "brand",
          "model",
          "condition",
        ]),
      );
      for (const field of [
        "name",
        "description",
        "categoryId",
        "brand",
        "model",
        "condition",
      ] as const) {
        expect(
          screen.getByTestId(`ai-suggested-badge-${field}`),
        ).toBeInTheDocument();
      }
    });
  });

  describe("AdditionalDetailsSection", () => {
    function renderAdditional(prefilled?: ReadonlySet<PrefilledFieldKey>) {
      return renderInProvider(
        <FormProvider {...(mockForm as any)}>
          <AdditionalDetailsSection
            control={mockForm.control as any}
            getValues={mockForm.getValues as any}
            addSpecification={vi.fn()}
            removeSpecification={vi.fn()}
          />
        </FormProvider>,
        { prefilledFields: prefilled },
      );
    }

    it("renders no badges and no safety disclaimer in the manual flow (Req 7.6 regression)", () => {
      renderAdditional();
      expect(
        screen.queryByTestId("ai-suggested-badge-instructions"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("ai-suggested-badge-safetyNotes"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("ai-suggested-badge-specifications"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("ai-safety-disclaimer"),
      ).not.toBeInTheDocument();
    });

    it("renders the SafetyDisclaimer when safetyNotes is prefilled (Req 7.6)", () => {
      renderAdditional(new Set(["safetyNotes"]));
      expect(screen.getByTestId("ai-safety-disclaimer")).toBeInTheDocument();
    });

    it("also renders the SafetyDisclaimer when only instructions is prefilled (Req 7.6)", () => {
      renderAdditional(new Set(["instructions"]));
      expect(screen.getByTestId("ai-safety-disclaimer")).toBeInTheDocument();
    });

    it("does NOT render the SafetyDisclaimer when neither safety field is prefilled", () => {
      renderAdditional(new Set(["specifications"]));
      expect(
        screen.queryByTestId("ai-safety-disclaimer"),
      ).not.toBeInTheDocument();
    });

    it("renders the specifications badge when specifications is prefilled", () => {
      renderAdditional(new Set(["specifications"]));
      expect(
        screen.getByTestId("ai-suggested-badge-specifications"),
      ).toBeInTheDocument();
    });

    it("renders instructions and safetyNotes badges when those fields are prefilled", () => {
      renderAdditional(new Set(["instructions", "safetyNotes"]));
      expect(
        screen.getByTestId("ai-suggested-badge-instructions"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("ai-suggested-badge-safetyNotes"),
      ).toBeInTheDocument();
    });
  });

  describe("AddListingForm (composed)", () => {
    let mockForm: ReturnType<typeof createMockForm>;

    beforeEach(async () => {
      vi.clearAllMocks();

      mockForm = createMockForm();
      mockForm.addImage = vi.fn();
      mockForm.removeImage = vi.fn();
      mockForm.addSpecification = vi.fn();
      mockForm.removeSpecification = vi.fn();

      const { useListingForm } =
        await import("@/features/listings/hooks/use-listing-form");
      const { useListingImages } =
        await import("@/features/listings/hooks/use-listing-images");
      const { useListingFormSubmit } =
        await import("@/features/listings/hooks/use-listing-form-submit");

      vi.mocked(useListingForm).mockReturnValue(mockForm as any);
      vi.mocked(useListingImages).mockReturnValue({
        images: [],
        loadImages: vi.fn(),
        deleteImage: vi.fn(),
        reorderImages: vi.fn(),
        isLoading: false,
      } as any);
      vi.mocked(useListingFormSubmit).mockReturnValue({
        handleSubmit: vi.fn(),
        isSubmitting: false,
        uploadProgress: null,
      } as any);
    });

    it("renders no DraftNotice when aiPrefilledFields is omitted (Req 7.6 regression)", () => {
      renderWithQueryClient(<AddListingForm categories={mockCategories} />);
      expect(screen.queryByTestId("ai-draft-notice")).not.toBeInTheDocument();
    });

    it("renders no DraftNotice when aiPrefilledFields is an empty array", () => {
      renderWithQueryClient(
        <AddListingForm categories={mockCategories} aiPrefilledFields={[]} />,
      );
      expect(screen.queryByTestId("ai-draft-notice")).not.toBeInTheDocument();
    });

    it("renders the DraftNotice when at least one field is prefilled (Req 7.5)", () => {
      renderWithQueryClient(
        <AddListingForm
          categories={mockCategories}
          aiPrefilledFields={["name"]}
        />,
      );
      expect(screen.getByTestId("ai-draft-notice")).toBeInTheDocument();
    });

    it("renders sections in the canonical Photos-first order (Req 2.1)", () => {
      const { container } = renderWithQueryClient(
        <AddListingForm categories={mockCategories} />,
      );

      // Section heading text in the canonical Req 2.1 order:
      //   Photos → Basic Information → Pricing & Rental Terms
      //   → Pickup & Delivery → Additional Details → Owner Policies
      const expectedOrder = [
        "Photos",
        "Basic Information",
        "Pricing & Rental Terms",
        "Pickup & Delivery",
        "Additional Details",
        "Owner Policies",
      ];

      const allText = container.textContent ?? "";
      // The first heading occurrence index for each section.
      const indices = expectedOrder.map((heading) => allText.indexOf(heading));
      // Every section is present...
      for (const [i, idx] of indices.entries()) {
        expect(idx, `Section "${expectedOrder[i]}" missing`).toBeGreaterThan(
          -1,
        );
      }
      // ...and they appear in the expected order.
      const sortedAscending = [...indices].sort((a, b) => a - b);
      expect(indices).toEqual(sortedAscending);
    });
  });
});
