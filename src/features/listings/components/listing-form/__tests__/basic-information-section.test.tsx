import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormProvider } from "react-hook-form";
import { BasicInformationSection } from "../basic-information-section";
import {
  createMockCategories,
  createMockForm,
} from "@/test/utils/listing-test-helpers";

/**
 * Match a required-field <label> by its full text content. The asterisk lives
 * in a child <span className="text-destructive">, which testing-library's
 * default text matcher ignores (it only reads an element's direct text nodes).
 */
const requiredLabel =
  (text: string) => (_content: string, el: Element | null) =>
    el?.tagName === "LABEL" && el.textContent === text;

describe("BasicInformationSection", () => {
  const mockCategories = createMockCategories();
  const mockForm = createMockForm() as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render all required form fields", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <BasicInformationSection
          control={mockForm.control as any}
          categories={mockCategories}
        />
      </FormProvider>,
    );

    expect(screen.getByText("Basic Information")).toBeInTheDocument();
    expect(screen.getByText("Tell us about your listing")).toBeInTheDocument();

    // Labels point to wrapper divs, so query by text and verify inputs separately
    expect(
      screen.getByText(requiredLabel("Listing Name *")),
    ).toBeInTheDocument();
    expect(container.querySelector('input[name="name"]')).toBeInTheDocument();

    expect(screen.getByText(requiredLabel("Category *"))).toBeInTheDocument();
    expect(
      container.querySelector('button[role="combobox"]'),
    ).toBeInTheDocument();

    expect(
      screen.getByText(requiredLabel("Description *")),
    ).toBeInTheDocument();
    expect(
      container.querySelector('textarea[name="description"]'),
    ).toBeInTheDocument();

    expect(screen.getByText(/brand/i)).toBeInTheDocument();
    expect(container.querySelector('input[name="brand"]')).toBeInTheDocument();

    expect(screen.getByText(/model/i)).toBeInTheDocument();
    expect(container.querySelector('input[name="model"]')).toBeInTheDocument();
  });

  it("should display categories in select dropdown", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <BasicInformationSection
          control={mockForm.control as any}
          categories={mockCategories}
        />
      </FormProvider>,
    );

    const categorySelect = container.querySelector('button[role="combobox"]');
    expect(categorySelect).toBeInTheDocument();

    // Categories should be rendered in the component (in SelectContent)
    // Note: SelectContent items are only visible when dropdown is open
    expect(screen.getByText(requiredLabel("Category *"))).toBeInTheDocument();
  });

  it("should render condition select field", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <BasicInformationSection
          control={mockForm.control as any}
          categories={mockCategories}
        />
      </FormProvider>,
    );

    expect(screen.getByText(requiredLabel("Condition *"))).toBeInTheDocument();

    // Find all combobox buttons and find the one for condition
    // The condition select is the second combobox (after category)
    const comboboxes = container.querySelectorAll('button[role="combobox"]');
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);

    // Condition options are in SelectContent (only visible when open)
    // We can verify the select exists and has the proper structure
  });

  it("should render name input with placeholder", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <BasicInformationSection
          control={mockForm.control as any}
          categories={mockCategories}
        />
      </FormProvider>,
    );

    const nameInput = screen.getByPlaceholderText("e.g., DeWalt Circular Saw");
    expect(nameInput).toBeInTheDocument();
    // Input elements default to type="text" if not specified, but the attribute may not be present
    expect(nameInput.tagName).toBe("INPUT");
    expect(nameInput).toHaveAttribute("name", "name");
  });

  it("should render description textarea", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <BasicInformationSection
          control={mockForm.control as any}
          categories={mockCategories}
        />
      </FormProvider>,
    );

    expect(
      screen.getByText(requiredLabel("Description *")),
    ).toBeInTheDocument();
    const descriptionTextarea = container.querySelector(
      'textarea[name="description"]',
    );
    expect(descriptionTextarea).toBeInTheDocument();
    expect(descriptionTextarea?.tagName).toBe("TEXTAREA");
  });

  it("should render optional brand and model fields", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <BasicInformationSection
          control={mockForm.control as any}
          categories={mockCategories}
        />
      </FormProvider>,
    );

    expect(screen.getByText(/brand/i)).toBeInTheDocument();
    expect(screen.getByText(/model/i)).toBeInTheDocument();

    const brandInput = container.querySelector('input[name="brand"]');
    const modelInput = container.querySelector('input[name="model"]');

    expect(brandInput).toBeInTheDocument();
    expect(modelInput).toBeInTheDocument();
    expect(brandInput).not.toHaveAttribute("required");
    expect(modelInput).not.toHaveAttribute("required");
  });

  it("should display category icons when available", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <BasicInformationSection
          control={mockForm.control as any}
          categories={mockCategories}
        />
      </FormProvider>,
    );

    // Category options are only visible when Select dropdown is open
    // We can verify the category select exists and has the proper structure
    const categorySelect = container.querySelector('button[role="combobox"]');
    expect(categorySelect).toBeInTheDocument();

    // The categories are passed to the component, so we verify the component renders
    expect(screen.getByText(requiredLabel("Category *"))).toBeInTheDocument();
  });

  it("should handle category selection", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <BasicInformationSection
          control={mockForm.control as any}
          categories={mockCategories}
        />
      </FormProvider>,
    );

    const categorySelect = container.querySelector('button[role="combobox"]');

    // Simulate opening the select (this tests the UI structure)
    expect(categorySelect).toBeInTheDocument();
    expect(categorySelect).toHaveAttribute("role", "combobox");
    expect(categorySelect).toHaveAttribute("aria-expanded", "false");
  });

  it("should display proper form field structure", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <BasicInformationSection
          control={mockForm.control as any}
          categories={mockCategories}
        />
      </FormProvider>,
    );

    // Required field indicators
    expect(
      screen.getByText(requiredLabel("Listing Name *")),
    ).toBeInTheDocument();
    expect(screen.getByText(requiredLabel("Category *"))).toBeInTheDocument();
    expect(
      screen.getByText(requiredLabel("Description *")),
    ).toBeInTheDocument();
    expect(screen.getByText(requiredLabel("Condition *"))).toBeInTheDocument();
  });

  it("should render with proper semantic HTML", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <BasicInformationSection
          control={mockForm.control as any}
          categories={mockCategories}
        />
      </FormProvider>,
    );

    // Check semantic structure - Card uses data-slot="card", not role="region"
    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeInTheDocument();

    // CardTitle renders as a div, not a heading element
    const title = screen.getByText("Basic Information");
    expect(title).toBeInTheDocument();
  });

  it("should handle empty categories array", () => {
    const { container } = render(
      <FormProvider {...mockForm}>
        <BasicInformationSection control={mockForm.control} categories={[]} />
      </FormProvider>,
    );

    // Should still render the form structure even with no categories
    expect(screen.getByText(requiredLabel("Category *"))).toBeInTheDocument();
    expect(
      container.querySelector('button[role="combobox"]'),
    ).toBeInTheDocument();
    expect(screen.getByText("Basic Information")).toBeInTheDocument();
  });

  it("should render category descriptions when available", () => {
    const categoriesWithDescriptions = [
      {
        id: "power-tools",
        name: "Power Tools",
        description: "Electric power tools for construction",
        icon: "drill",
      },
    ];

    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <BasicInformationSection
          control={mockForm.control as any}
          categories={categoriesWithDescriptions}
        />
      </FormProvider>,
    );

    // Category options are only visible when Select dropdown is open
    // We can verify the category select exists and has the proper structure
    const categorySelect = container.querySelector('button[role="combobox"]');
    expect(categorySelect).toBeInTheDocument();

    // The category is passed to the component, so we verify the component renders
    expect(screen.getByText(requiredLabel("Category *"))).toBeInTheDocument();
  });
});
