import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormProvider } from "react-hook-form";
import {
  LegalDocumentAcknowledgments,
  type OwnerPolicyDocuments,
} from "../legal-document-acknowledgments";
import { createMockForm } from "@/test/utils/listing-test-helpers";
import {
  LEGAL_DOCUMENT_IDS,
  LEGAL_DOCUMENT_METADATA,
} from "@/constants/legal-documents";

describe("LegalDocumentAcknowledgments", () => {
  const mockForm = createMockForm() as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the component with title and description", () => {
    render(
      <FormProvider {...mockForm}>
        <LegalDocumentAcknowledgments control={mockForm.control} />
      </FormProvider>,
    );

    expect(screen.getByText("Owner Policies")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Please review the following policies before creating your listing.",
      ),
    ).toBeInTheDocument();
  });

  it("should render all 2 document links", () => {
    render(
      <FormProvider {...mockForm}>
        <LegalDocumentAcknowledgments control={mockForm.control} />
      </FormProvider>,
    );

    expect(
      screen.getAllByText(
        LEGAL_DOCUMENT_METADATA[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]
          ?.name || "",
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(
        LEGAL_DOCUMENT_METADATA[
          LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT
        ]?.name || "",
      ).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("should render the acknowledgment checkbox", () => {
    render(
      <FormProvider {...mockForm}>
        <LegalDocumentAcknowledgments control={mockForm.control} />
      </FormProvider>,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /I have read and agree to the Owner Policies listed above/i,
    });
    expect(checkbox).toBeInTheDocument();
  });

  it("should render clickable policy names in the description", () => {
    render(
      <FormProvider {...mockForm}>
        <LegalDocumentAcknowledgments control={mockForm.control} />
      </FormProvider>,
    );

    const description = screen.getByText(/This includes:/i);
    expect(description).toBeInTheDocument();

    // Check that policy names are clickable links
    const policyLinks = screen.getAllByRole("link");
    expect(policyLinks.length).toBeGreaterThanOrEqual(2); // At least 2 PDF links
  });

  it("should open modal when document link is clicked", async () => {
    render(
      <FormProvider {...mockForm}>
        <LegalDocumentAcknowledgments control={mockForm.control} />
      </FormProvider>,
    );

    const safetyLiabilityButton = screen.getAllByRole("button", {
      name:
        LEGAL_DOCUMENT_METADATA[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]
          ?.name || "",
    })[0];
    fireEvent.click(safetyLiabilityButton);

    await waitFor(() => {
      expect(
        screen.getByText(/This comprehensive package combines/i),
      ).toBeInTheDocument();
    });

    // Check that modal content is visible
    expect(screen.getByText(/View full document/i)).toBeInTheDocument();
  });

  it("should display document summary in modal", async () => {
    render(
      <FormProvider {...mockForm}>
        <LegalDocumentAcknowledgments control={mockForm.control} />
      </FormProvider>,
    );

    const safetyLiabilityButton = screen.getAllByRole("button", {
      name:
        LEGAL_DOCUMENT_METADATA[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]
          ?.name || "",
    })[0];
    fireEvent.click(safetyLiabilityButton);

    await waitFor(() => {
      expect(
        screen.getByText(/This comprehensive package combines/i),
      ).toBeInTheDocument();
    });
  });

  it("should display PDF link in modal", async () => {
    render(
      <FormProvider {...mockForm}>
        <LegalDocumentAcknowledgments control={mockForm.control} />
      </FormProvider>,
    );

    // Find the button by its role and accessible name
    const safetyLiabilityButton = screen.getAllByRole("button", {
      name:
        LEGAL_DOCUMENT_METADATA[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]
          ?.name || "",
    })[0];

    expect(safetyLiabilityButton).toBeInTheDocument();
    fireEvent.click(safetyLiabilityButton);

    await waitFor(() => {
      const pdfLink = screen.getByText(/View full document/i);
      expect(pdfLink).toBeInTheDocument();
      expect(pdfLink.closest("a")).toHaveAttribute(
        "href",
        "/documents/safety-and-liability-package.pdf",
      );
      expect(pdfLink.closest("a")).toHaveAttribute("target", "_blank");
      expect(pdfLink.closest("a")).toHaveAttribute(
        "rel",
        "noopener noreferrer",
      );
    });
  });

  it("should bind checkbox to form control", () => {
    render(
      <FormProvider {...mockForm}>
        <LegalDocumentAcknowledgments control={mockForm.control} />
      </FormProvider>,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /I have read and agree to the Owner Policies listed above/i,
    });

    // Verify checkbox is rendered and not checked initially
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute("id", "ownerPoliciesAcknowledged");
    expect(checkbox).toHaveAttribute(
      "aria-label",
      "I have read and agree to the Owner Policies listed above",
    );

    // Verify checkbox is enabled and interactive
    expect(checkbox).not.toBeDisabled();
    expect(checkbox).toHaveAttribute("type", "button");
    expect(checkbox).toHaveAttribute("role", "checkbox");
  });

  it("should show validation error when checkbox is not checked", () => {
    const formWithError = {
      ...mockForm,
      formState: {
        ...mockForm.formState,
        errors: {
          ownerPoliciesAcknowledged: {
            message:
              "You must acknowledge the Owner Policies to create a listing.",
          },
        },
      },
      control: {
        ...mockForm.control,
        _getWatch: vi.fn(() => false),
        _formValues: { ownerPoliciesAcknowledged: false },
      },
    };

    // Mock getFieldState to return the error
    formWithError.getFieldState = vi.fn(() => ({
      error: {
        message: "You must acknowledge the Owner Policies to create a listing.",
      },
      invalid: true,
      isDirty: false,
      isTouched: true,
    }));

    render(
      <FormProvider {...formWithError}>
        <LegalDocumentAcknowledgments control={formWithError.control} />
      </FormProvider>,
    );

    expect(
      screen.getByText(
        /You must acknowledge the Owner Policies to create a listing/i,
      ),
    ).toBeInTheDocument();
  });

  it("should render all documents in a vertical list", () => {
    const { container } = render(
      <FormProvider {...mockForm}>
        <LegalDocumentAcknowledgments control={mockForm.control} />
      </FormProvider>,
    );

    const list = container.querySelector("ul");
    expect(list).toBeInTheDocument();

    const listItems = list?.querySelectorAll("li");
    expect(listItems?.length).toBe(2);
  });

  it("should have correct PDF links for each document", () => {
    render(
      <FormProvider {...mockForm}>
        <LegalDocumentAcknowledgments control={mockForm.control} />
      </FormProvider>,
    );

    // Check that PDF links in description have correct hrefs (fallback when no ownerPolicyDocuments)
    const links = screen.getAllByRole("link");
    const pdfLinks = links.filter((link) =>
      link.getAttribute("href")?.startsWith("/documents/"),
    );

    expect(pdfLinks.length).toBeGreaterThanOrEqual(2);
    expect(
      pdfLinks.some((link) =>
        link.getAttribute("href")?.includes("safety-and-liability-package"),
      ),
    ).toBe(true);
    expect(
      pdfLinks.some((link) =>
        link
          .getAttribute("href")
          ?.includes("prohibited-items-and-listing-content-policy"),
      ),
    ).toBe(true);
  });

  it("should use ownerPolicyDocuments URLs when provided", async () => {
    const ownerPolicyDocuments: OwnerPolicyDocuments = {
      safetyLiabilityPackage: {
        id: LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE,
        version: "1.0",
        url: "https://example.com/safety-liability.pdf",
        publishedAt: new Date(),
      },
      prohibitedItemsAndListingContent: {
        id: LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT,
        version: "1.0",
        url: "https://example.com/prohibited-items.pdf",
        publishedAt: new Date(),
      },
    };

    render(
      <FormProvider {...mockForm}>
        <LegalDocumentAcknowledgments
          control={mockForm.control}
          ownerPolicyDocuments={ownerPolicyDocuments}
        />
      </FormProvider>,
    );

    const links = screen.getAllByRole("link");
    expect(
      links.some(
        (link) =>
          link.getAttribute("href") ===
          "https://example.com/safety-liability.pdf",
      ),
    ).toBe(true);
    expect(
      links.some(
        (link) =>
          link.getAttribute("href") ===
          "https://example.com/prohibited-items.pdf",
      ),
    ).toBe(true);

    // Modal "View full document" should use the provided URL
    const safetyLiabilityButton = screen.getAllByRole("button", {
      name:
        LEGAL_DOCUMENT_METADATA[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]
          ?.name || "",
    })[0];
    fireEvent.click(safetyLiabilityButton);

    await waitFor(() => {
      const pdfLink = screen.getByText(/View full document/i);
      expect(pdfLink.closest("a")).toHaveAttribute(
        "href",
        "https://example.com/safety-liability.pdf",
      );
    });
  });
});
