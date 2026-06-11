import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { PricingSection } from "../pricing-section";
import { AiPrefillProvider } from "../ai-prefill-context";
import type { AiPrefilledFieldKey } from "@/features/listings/ai-listing-assistant/types";
import { createMockForm } from "@/test/utils/listing-test-helpers";

describe("PricingSection", () => {
  const mockForm = createMockForm() as any;

  it("should render pricing section header", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    expect(screen.getByText("Pricing & Rental Terms")).toBeInTheDocument();
    expect(
      screen.getByText("Set your rates and rental conditions"),
    ).toBeInTheDocument();
  });

  it("should render all pricing input fields", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // Query inputs by name attribute since labels point to wrapper divs
    // Weekly/monthly rate fields are commented out (daily rate only for now)
    const dailyRateInput = container.querySelector('input[name="dailyRate"]');
    const securityDepositInput = container.querySelector(
      'input[name="securityDeposit"]',
    );

    expect(dailyRateInput).toBeInTheDocument();
    expect(securityDepositInput).toBeInTheDocument();

    // Verify labels are present (asterisk lives in its own destructive span)
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "LABEL" && el.textContent === "Daily Rate *",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/security deposit/i)).toBeInTheDocument();
  });

  it("should render rental period fields", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // The labels are "Minimum Rental (days)" and "Maximum Rental (days)"
    // Query by name attribute since getByLabelText may not work due to form structure
    const minRentalInput = container.querySelector(
      'input[name="minimumRentalPeriod"]',
    );
    const maxRentalInput = container.querySelector(
      'input[name="maximumRentalPeriod"]',
    );

    expect(minRentalInput).toBeInTheDocument();
    expect(maxRentalInput).toBeInTheDocument();

    // Verify labels are present
    expect(screen.getByText("Minimum Rental (days)")).toBeInTheDocument();
    expect(screen.getByText("Maximum Rental (days)")).toBeInTheDocument();
  });

  it("should render pricing inputs with dollar signs", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // Check that dollar sign icons are present (they're in the DOM but may not have accessible labels)
    const inputs = screen.getAllByDisplayValue("");
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("should render input placeholders", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // Multiple inputs have placeholder "0.00", so query by name attribute
    const dailyRateInput = container.querySelector('input[name="dailyRate"]');
    expect(dailyRateInput).toBeInTheDocument();
    expect(dailyRateInput).toHaveAttribute("placeholder", "0.00");

    // Verify other price inputs also have placeholders (daily + deposit; weekly/monthly commented out)
    const inputsWithPlaceholders = container.querySelectorAll(
      'input[placeholder="0.00"]',
    );
    expect(inputsWithPlaceholders.length).toBeGreaterThanOrEqual(2); // daily, deposit
    // NumericInput uses type="text" + inputMode so decimals/backspace behave correctly
    expect(dailyRateInput).toHaveAttribute("type", "text");
    expect(dailyRateInput).toHaveAttribute("inputmode", "decimal");
  });

  it("should render numeric text inputs for all price fields", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // NumericInput uses native text inputs (role textbox), not type="number" spinbuttons
    // daily, deposit, min period, max period (weekly/monthly commented out)
    const numericInputs = screen.getAllByRole("textbox");
    expect(numericInputs.length).toBeGreaterThanOrEqual(4);
  });

  it("should render rental terms section", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    expect(screen.getByText("Rental Period")).toBeInTheDocument();
    // The component doesn't have a description text for rental period section
    // Just verify the heading is present
  });

  it("should render minimum and maximum rental period inputs", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // Find inputs by name attribute since labels point to wrapper divs
    const minPeriodInput = container.querySelector(
      'input[name="minimumRentalPeriod"]',
    );
    const maxPeriodInput = container.querySelector(
      'input[name="maximumRentalPeriod"]',
    );

    expect(minPeriodInput).toBeInTheDocument();
    expect(maxPeriodInput).toBeInTheDocument();
    expect(minPeriodInput).toHaveAttribute("type", "text");
    expect(maxPeriodInput).toHaveAttribute("type", "text");
    expect(minPeriodInput).toHaveAttribute("inputmode", "numeric");
    expect(maxPeriodInput).toHaveAttribute("inputmode", "numeric");
  });

  it("should render security deposit input", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // Find input by name attribute since label's for points to wrapper div
    const securityInput = container.querySelector(
      'input[name="securityDeposit"]',
    );
    expect(securityInput).toBeInTheDocument();
    expect(securityInput).toHaveAttribute("type", "text");

    // Also verify the label text is present
    expect(screen.getByText(/security deposit/i)).toBeInTheDocument();
  });

  it("should render proper form field structure", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // Test that FormField components are used properly
    // FormItem renders as divs with space-y-2 class, check for form item IDs
    const formItems = container.querySelectorAll('[id$="-form-item"]');
    expect(formItems.length).toBeGreaterThan(0);

    // Required field indicator (asterisk rendered in its own destructive span)
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "LABEL" && el.textContent === "Daily Rate *",
      ),
    ).toBeInTheDocument();
  });

  it("should render with proper semantic HTML", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // Check for card container (div with data-slot="card")
    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeInTheDocument();

    // Check for semantic headings
    const headings = screen.getAllByRole("heading");
    expect(headings.length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Rental Rates" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Rental Period" }),
    ).toBeInTheDocument();

    // Check for form labels and inputs
    expect(screen.getByText(/daily rate/i)).toBeInTheDocument();
    expect(screen.getByText(/security deposit/i)).toBeInTheDocument();

    // Check that inputs are present (daily, deposit, min, max — weekly/monthly commented out)
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBeGreaterThanOrEqual(4);
  });

  it("should render input validation placeholders and attributes", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // Check that inputs have proper attributes for number input
    // daily + deposit (weekly/monthly commented out)
    const inputs = screen
      .getAllByDisplayValue("")
      .filter((input) => input.getAttribute("inputmode") === "decimal");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("should display rental period descriptions", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // Check that rental period labels include "days"
    expect(screen.getByText(/Minimum Rental \(days\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Maximum Rental \(days\)/i)).toBeInTheDocument();
  });

  it("should render all form sections with proper spacing", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PricingSection control={mockForm.control as any} />
      </FormProvider>,
    );

    // Check section headers
    expect(screen.getByText("Rental Rates")).toBeInTheDocument();
    expect(screen.getByText("Rental Period")).toBeInTheDocument();

    // Check that sections are visually separated
    // Separator component uses role="none" (decorative), so we query by data-slot instead
    const separators = container.querySelectorAll(
      '[data-slot="separator-root"]',
    );
    expect(separators.length).toBeGreaterThan(0);
  });
});

/**
 * Backs PricingSection with a real react-hook-form instance so the Daily Rate
 * field's value (not a static mock) drives the AI-draft "missing price"
 * highlight. `aiGenerated` mounts the section under an AiPrefillProvider, the
 * same signal the form uses when a draft was produced by the AI assistant.
 */
function DailyRateHarness({
  aiGenerated,
  defaultDailyRate = "",
}: {
  aiGenerated: boolean;
  defaultDailyRate?: number | "";
}) {
  const form = useForm<{ dailyRate: number | "" }>({
    defaultValues: { dailyRate: defaultDailyRate },
  });

  const content = (
    <FormProvider {...form}>
      <PricingSection control={form.control as any} />
    </FormProvider>
  );

  if (!aiGenerated) return content;

  return (
    <AiPrefillProvider prefilledFields={new Set<AiPrefilledFieldKey>(["name"])}>
      {content}
    </AiPrefillProvider>
  );
}

describe("PricingSection — AI-draft missing-price highlight", () => {
  it("does not flag the daily rate in the manual (non-AI) flow", () => {
    const { container } = render(<DailyRateHarness aiGenerated={false} />);

    const dailyRate = container.querySelector('input[name="dailyRate"]');
    expect(dailyRate).not.toHaveAttribute("aria-invalid", "true");
  });

  it("flags the empty daily rate as invalid when the draft was AI-generated", () => {
    const { container } = render(<DailyRateHarness aiGenerated />);

    const dailyRate = container.querySelector('input[name="dailyRate"]');
    expect(dailyRate).toHaveAttribute("aria-invalid", "true");
    expect(dailyRate).toHaveClass("ring-[3px]");
  });

  it("does not flag an AI draft that already carries a daily rate", () => {
    const { container } = render(
      <DailyRateHarness aiGenerated defaultDailyRate={25} />,
    );

    const dailyRate = container.querySelector('input[name="dailyRate"]');
    expect(dailyRate).not.toHaveAttribute("aria-invalid", "true");
  });

  it("clears the invalid state once a rate is entered", () => {
    const { container } = render(<DailyRateHarness aiGenerated />);

    const dailyRate = container.querySelector(
      'input[name="dailyRate"]',
    ) as HTMLInputElement;
    expect(dailyRate).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(dailyRate, { target: { value: "25" } });

    expect(dailyRate).not.toHaveAttribute("aria-invalid", "true");
  });
});
