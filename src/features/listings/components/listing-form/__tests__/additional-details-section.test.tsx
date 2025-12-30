import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormProvider } from "react-hook-form";
import { AdditionalDetailsSection } from "../additional-details-section";
import {
  createMockForm,
  createMockFormData,
} from "@/test/utils/listing-test-helpers";

describe("AdditionalDetailsSection", () => {
  const mockForm = createMockForm() as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render additional details section header", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    expect(screen.getByText("Additional Details")).toBeInTheDocument();
    expect(
      screen.getByText("Optional specifications and instructions"),
    ).toBeInTheDocument();
  });

  it("should render specifications section", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    expect(screen.getByText("Specifications")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Specification name (e.g., Power)"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Value (e.g., 1200W)"),
    ).toBeInTheDocument();
  });

  it("should render add specification button", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    // Find add button by Plus icon
    const allButtons = container.querySelectorAll('button[type="button"]');
    const addButton = Array.from(allButtons).find((btn) =>
      btn.querySelector("svg.lucide-plus"),
    ) as HTMLButtonElement;

    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeDisabled(); // Should be disabled when inputs are empty
  });

  it("should enable add button when both inputs have values", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    const nameInput = screen.getByPlaceholderText(
      "Specification name (e.g., Power)",
    );
    const valueInput = screen.getByPlaceholderText("Value (e.g., 1200W)");
    // Find add button by Plus icon
    const allButtons = container.querySelectorAll('button[type="button"]');
    const addButton = Array.from(allButtons).find((btn) =>
      btn.querySelector("svg.lucide-plus"),
    ) as HTMLButtonElement;

    expect(addButton).toBeInTheDocument();
    // Initially disabled
    expect(addButton).toBeDisabled();

    // Fill inputs
    fireEvent.change(nameInput, { target: { value: "Power" } });
    fireEvent.change(valueInput, { target: { value: "1200W" } });

    // Should now be enabled
    expect(addButton).toBeEnabled();
  });

  it("should call addSpecification when add button is clicked", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    const nameInput = screen.getByPlaceholderText(
      "Specification name (e.g., Power)",
    );
    const valueInput = screen.getByPlaceholderText("Value (e.g., 1200W)");
    // Find add button by Plus icon
    const allButtons = container.querySelectorAll('button[type="button"]');
    const addButton = Array.from(allButtons).find((btn) =>
      btn.querySelector("svg.lucide-plus"),
    ) as HTMLButtonElement;

    expect(addButton).toBeInTheDocument();
    fireEvent.change(nameInput, { target: { value: "Power" } });
    fireEvent.change(valueInput, { target: { value: "1200W" } });
    fireEvent.click(addButton);

    expect(mockForm.addSpecification).toHaveBeenCalledWith("Power", "1200W");
  });

  it("should clear inputs after adding specification", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    const nameInput = screen.getByPlaceholderText(
      "Specification name (e.g., Power)",
    );
    const valueInput = screen.getByPlaceholderText("Value (e.g., 1200W)");
    // Find add button by Plus icon (not by accessible name)
    const allButtons = container.querySelectorAll('button[type="button"]');
    const addButton = Array.from(allButtons).find((btn) =>
      btn.querySelector("svg.lucide-plus"),
    );

    expect(addButton).toBeInTheDocument();
    fireEvent.change(nameInput, { target: { value: "Power" } });
    fireEvent.change(valueInput, { target: { value: "1200W" } });
    fireEvent.click(addButton!);

    // Inputs should be cleared (though this is handled by component state, not form state)
    // The component manages its own local state for the inputs
    expect(nameInput).toHaveValue("");
    expect(valueInput).toHaveValue("");
  });

  it("should display existing specifications", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "specifications") {
        return {
          Power: "1200W",
          Weight: "5.2 lbs",
          Voltage: "120V",
        };
      }
      return createMockFormData();
    });

    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    // The component renders key and value separately: <span>{key}:</span> {String(value)}
    // Check for text content in specification items
    const specItems = container.querySelectorAll(
      ".flex.items-center.justify-between.rounded-lg.border.p-3",
    );
    expect(specItems.length).toBe(3);

    const specTexts = Array.from(specItems).map((item) => item.textContent);
    expect(
      specTexts.some(
        (text) => text?.includes("Power") && text?.includes("1200W"),
      ),
    ).toBe(true);
    expect(
      specTexts.some(
        (text) => text?.includes("Weight") && text?.includes("5.2 lbs"),
      ),
    ).toBe(true);
    expect(
      specTexts.some(
        (text) => text?.includes("Voltage") && text?.includes("120V"),
      ),
    ).toBe(true);
  });

  it("should render remove buttons for each specification", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "specifications") {
        return {
          Power: "1200W",
          Weight: "5.2 lbs",
        };
      }
      return createMockFormData();
    });

    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    // Find remove buttons by querying for buttons with X icon within specification items
    const allButtons = container.querySelectorAll('button[type="button"]');
    const removeButtonsWithX = Array.from(allButtons).filter((btn) =>
      btn.querySelector("svg.lucide-x"),
    );

    // Should have one remove button per specification (2 specifications = 2 remove buttons)
    expect(removeButtonsWithX.length).toBe(2);
  });

  it("should call removeSpecification when remove button is clicked", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "specifications") {
        return {
          Power: "1200W",
        };
      }
      return createMockFormData();
    });

    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    // Find remove buttons by querying for buttons within specification items
    const specItems = container.querySelectorAll(
      ".flex.items-center.justify-between.rounded-lg.border.p-3",
    );
    expect(specItems.length).toBeGreaterThan(0);

    // Get the first remove button (X icon button) - it's the button with X icon inside
    const allButtons = container.querySelectorAll('button[type="button"]');
    // The remove buttons are the ones with X icon (not the add button which has Plus icon)
    const removeButton = Array.from(allButtons).find(
      (btn) =>
        btn.querySelector("svg.lucide-x") ||
        btn.getAttribute("aria-label")?.includes("Remove"),
    );

    expect(removeButton).toBeInTheDocument();
    fireEvent.click(removeButton!);

    expect(mockForm.removeSpecification).toHaveBeenCalledWith("Power");
  });

  it("should render instructions textarea", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    // Query textarea by name attribute since label points to wrapper div
    const textarea = container.querySelector('textarea[name="instructions"]');
    expect(textarea).toBeInTheDocument();
    expect(textarea?.tagName).toBe("TEXTAREA");
    // Check for placeholder text
    expect(textarea).toHaveAttribute(
      "placeholder",
      "How to use this tool safely and effectively...",
    );
  });

  it("should render safety notes textarea", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    expect(screen.getByText("Safety Notes")).toBeInTheDocument();
    // Query textarea by name attribute since label points to wrapper div
    const textarea = container.querySelector('textarea[name="safetyNotes"]');
    expect(textarea).toBeInTheDocument();
    expect(textarea?.tagName).toBe("TEXTAREA");
  });

  it("should render with proper semantic HTML", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    // Card component uses data-slot="card", not role="region"
    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeInTheDocument();

    // CardTitle renders as a div, not a heading element
    const title = screen.getByText("Additional Details");
    expect(title).toBeInTheDocument();
  });

  it("should hide specifications list when empty", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "specifications") return {};
      return createMockFormData();
    });

    render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    // The component conditionally renders the list only when Object.entries().length > 0
    // When empty, no specification items should be displayed
    // Check that no specification list items exist (they have rounded-lg border p-3 styling)
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    // Check that no specification list items exist (they have rounded-lg border p-3 styling)
    const specItems = container.querySelectorAll(".rounded-lg.border.p-3");
    expect(specItems.length).toBe(0);
  });

  it("should handle different specification value types", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "specifications") {
        return {
          Power: "1200W",
          Weight: 5.2,
          Cordless: true,
          Accessories: ["battery", "charger"],
        };
      }
      return createMockFormData();
    });

    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    // The component renders key and value separately: <span>{key}:</span> {String(value)}
    // Find all specification items by their container class
    const specItems = container.querySelectorAll(
      ".flex.items-center.justify-between.rounded-lg.border.p-3",
    );
    expect(specItems.length).toBe(4);

    // Check each specification item's text content
    const specTexts = Array.from(specItems).map((item) => item.textContent);
    expect(
      specTexts.some(
        (text) => text?.includes("Power") && text?.includes("1200W"),
      ),
    ).toBe(true);
    expect(
      specTexts.some(
        (text) => text?.includes("Weight") && text?.includes("5.2"),
      ),
    ).toBe(true);
    expect(
      specTexts.some(
        (text) => text?.includes("Cordless") && text?.includes("true"),
      ),
    ).toBe(true);
    expect(
      specTexts.some(
        (text) => text?.includes("Accessories") && text?.includes("battery"),
      ),
    ).toBe(true);
  });

  it("should render proper form field structure", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <AdditionalDetailsSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addSpecification={mockForm.addSpecification}
          removeSpecification={mockForm.removeSpecification}
        />
      </FormProvider>,
    );

    // The component uses FormField for instructions and safetyNotes
    // Check that those textareas exist
    expect(
      screen.getByPlaceholderText(/How to use this tool safely/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Important safety information/i),
    ).toBeInTheDocument();

    // Check that specification inputs exist
    expect(
      screen.getByPlaceholderText(/Specification name/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Value \(e\.g\., 1200W\)/i),
    ).toBeInTheDocument();

    // Check that labels exist (they point to wrapper divs, so query by text)
    expect(screen.getByText(/Usage Instructions/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety Notes/i)).toBeInTheDocument();
  });
});
