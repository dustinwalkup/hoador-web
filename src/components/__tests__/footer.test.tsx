import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "../footer";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock Next.js Image
vi.mock("next/image", () => ({
  default: (props: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt || ""} />
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ExternalLink: () => <span data-testid="external-link-icon" />,
}));

// Mock legalDocumentDAL
vi.mock("@/dal/legal-document.dal", () => ({
  legalDocumentDAL: {
    getAllCurrentVersions: vi.fn(),
  },
}));

// Mock tryCatch
vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";

describe("Footer", () => {
  const mockDocumentVersions = {
    [LEGAL_DOCUMENT_IDS.TOS]: {
      id: LEGAL_DOCUMENT_IDS.TOS,
      version: "1.0",
      url: "https://example.com/tos.pdf",
      publishedAt: new Date("2024-01-01"),
    },
    [LEGAL_DOCUMENT_IDS.PRIVACY]: {
      id: LEGAL_DOCUMENT_IDS.PRIVACY,
      version: "1.0",
      url: "https://example.com/privacy.pdf",
      publishedAt: new Date("2024-01-01"),
    },
    [LEGAL_DOCUMENT_IDS.COMMUNITY]: {
      id: LEGAL_DOCUMENT_IDS.COMMUNITY,
      version: "1.0",
      url: "https://example.com/community.pdf",
      publishedAt: new Date("2024-01-01"),
    },
    [LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND]: {
      id: LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND,
      version: "1.0",
      url: "https://example.com/cancellation.pdf",
      publishedAt: new Date("2024-01-01"),
    },
    [LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER]: {
      id: LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER,
      version: "1.0",
      url: "https://example.com/safety.pdf",
      publishedAt: new Date("2024-01-01"),
    },
    [LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY]: {
      id: LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY,
      version: "1.0",
      url: "https://example.com/damage.pdf",
      publishedAt: new Date("2024-01-01"),
    },
    [LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS]: {
      id: LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS,
      version: "1.0",
      url: "https://example.com/payments.pdf",
      publishedAt: new Date("2024-01-01"),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render footer with all sections", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      const { container } = render(await Footer());

      expect(container.querySelector("footer")).toBeInTheDocument();
      expect(screen.getByText("Legal")).toBeInTheDocument();
      expect(screen.getByText("Policies")).toBeInTheDocument();
      expect(screen.getByText("Support")).toBeInTheDocument();
    });

    it("should render logo and copyright", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      render(await Footer());

      const logo = screen.getByAltText("Hoador logo");
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute("src", "/hoador-logo.svg");

      const currentYear = new Date().getFullYear();
      expect(
        screen.getByText(`© ${currentYear} Hoador, Inc. All rights reserved`),
      ).toBeInTheDocument();
    });

    it("should render all legal document links when documents exist", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      render(await Footer());

      expect(screen.getByText("Terms of Service")).toBeInTheDocument();
      expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
      expect(screen.getByText("Community Guidelines")).toBeInTheDocument();
    });

    it("should render all policy document links when documents exist", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      render(await Footer());

      expect(
        screen.getByText("Cancellation & Refund Policy"),
      ).toBeInTheDocument();
      expect(screen.getByText("Safety Guidelines")).toBeInTheDocument();
      expect(screen.getByText("Damage & Liability")).toBeInTheDocument();
      expect(screen.getByText("Payments & Fees")).toBeInTheDocument();
    });

    it("should render support links", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      render(await Footer());

      const helpCenterLink = screen.getByText("Help Center");
      expect(helpCenterLink).toBeInTheDocument();
      expect(helpCenterLink.closest("a")).toHaveAttribute("href", "/help");

      const reportIssueLink = screen.getByText("Report an Issue");
      expect(reportIssueLink).toBeInTheDocument();
      expect(reportIssueLink.closest("a")).toHaveAttribute(
        "href",
        "/help/report",
      );
    });

    it("should not render document links when documents do not exist", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: {},
        error: null,
      });

      render(await Footer());

      expect(screen.queryByText("Terms of Service")).not.toBeInTheDocument();
      expect(screen.queryByText("Privacy Policy")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Community Guidelines"),
      ).not.toBeInTheDocument();
    });

    it("should render partial documents when some exist", async () => {
      const partialDocuments = {
        [LEGAL_DOCUMENT_IDS.TOS]: mockDocumentVersions[LEGAL_DOCUMENT_IDS.TOS],
        [LEGAL_DOCUMENT_IDS.PRIVACY]:
          mockDocumentVersions[LEGAL_DOCUMENT_IDS.PRIVACY],
      };

      vi.mocked(tryCatch).mockResolvedValue({
        data: partialDocuments,
        error: null,
      });

      render(await Footer());

      expect(screen.getByText("Terms of Service")).toBeInTheDocument();
      expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
      expect(
        screen.queryByText("Community Guidelines"),
      ).not.toBeInTheDocument();
    });
  });

  describe("External Links", () => {
    it("should render external links with correct attributes for PDF documents", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      render(await Footer());

      const tosLink = screen.getByText("Terms of Service").closest("a");
      expect(tosLink).toHaveAttribute("href", "https://example.com/tos.pdf");
      expect(tosLink).toHaveAttribute("target", "_blank");
      expect(tosLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(
        screen.getAllByTestId("external-link-icon").length,
      ).toBeGreaterThan(0);
    });

    it("should render external link icon for all PDF document links", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      render(await Footer());

      // Count external link icons - should match number of document links
      const externalIcons = screen.getAllByTestId("external-link-icon");
      // We have 7 document links + 2 support links (no icons) = 7 icons
      expect(externalIcons.length).toBe(7);
    });

    it("should not render external link icon for support links", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      render(await Footer());

      const helpCenterLink = screen.getByText("Help Center").closest("a");
      expect(helpCenterLink).not.toHaveAttribute("target", "_blank");
      expect(helpCenterLink).not.toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("Error Handling", () => {
    it("should render footer gracefully when document fetch fails", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: null,
        error: new Error("Failed to fetch documents"),
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      render(await Footer());

      // Footer should still render with support links
      expect(screen.getByText("Support")).toBeInTheDocument();
      expect(screen.getByText("Help Center")).toBeInTheDocument();
      expect(screen.getByText("Report an Issue")).toBeInTheDocument();

      // Should log error
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching legal documents for footer:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should render footer when documents are null", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: null,
        error: null,
      });

      render(await Footer());

      // Footer should still render
      expect(screen.getByText("Support")).toBeInTheDocument();
      expect(screen.queryByText("Terms of Service")).not.toBeInTheDocument();
    });

    it("should render footer when documents are undefined", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: undefined,
        error: null,
      });

      render(await Footer());

      // Footer should still render
      expect(screen.getByText("Support")).toBeInTheDocument();
      expect(screen.queryByText("Terms of Service")).not.toBeInTheDocument();
    });
  });

  describe("Layout and Styling", () => {
    it("should have correct footer structure", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      const { container } = render(await Footer());

      const footer = container.querySelector("footer");
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass("bg-muted/40", "border-t");
    });

    it("should have responsive grid layout", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      const { container } = render(await Footer());

      const grid = container.querySelector(".grid");
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-3");
    });

    it("should have desktop padding for sidebar", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      const { container } = render(await Footer());

      const innerDiv = container.querySelector(
        ".mobile-padding.container.mx-auto",
      );
      expect(innerDiv).toBeInTheDocument();
      expect(innerDiv).toHaveClass("md:pl-64");
    });
  });

  describe("Document Display Names", () => {
    it("should display correct names for legal documents", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: {
          [LEGAL_DOCUMENT_IDS.TOS]:
            mockDocumentVersions[LEGAL_DOCUMENT_IDS.TOS],
          [LEGAL_DOCUMENT_IDS.PRIVACY]:
            mockDocumentVersions[LEGAL_DOCUMENT_IDS.PRIVACY],
          [LEGAL_DOCUMENT_IDS.COMMUNITY]:
            mockDocumentVersions[LEGAL_DOCUMENT_IDS.COMMUNITY],
        },
        error: null,
      });

      render(await Footer());

      expect(screen.getByText("Terms of Service")).toBeInTheDocument();
      expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
      expect(screen.getByText("Community Guidelines")).toBeInTheDocument();
    });

    it("should display 'Safety Guidelines' for safety disclaimer document", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: {
          [LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER]:
            mockDocumentVersions[LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER],
        },
        error: null,
      });

      render(await Footer());

      // Should display as "Safety Guidelines" not "Safety Disclaimer"
      expect(screen.getByText("Safety Guidelines")).toBeInTheDocument();
      expect(screen.queryByText("Safety Disclaimer")).not.toBeInTheDocument();
    });

    it("should display 'Damage & Liability' for damage loss liability document", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: {
          [LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY]:
            mockDocumentVersions[LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY],
        },
        error: null,
      });

      render(await Footer());

      expect(screen.getByText("Damage & Liability")).toBeInTheDocument();
    });

    it("should display 'Payments & Fees' for payments payouts document", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: {
          [LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS]:
            mockDocumentVersions[LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS],
        },
        error: null,
      });

      render(await Footer());

      expect(screen.getByText("Payments & Fees")).toBeInTheDocument();
    });
  });

  describe("Support Section", () => {
    it("should always render support section regardless of document availability", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: {},
        error: null,
      });

      render(await Footer());

      expect(screen.getByText("Support")).toBeInTheDocument();
      expect(screen.getByText("Help Center")).toBeInTheDocument();
      expect(screen.getByText("Report an Issue")).toBeInTheDocument();
    });

    it("should render support links as internal navigation links", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      render(await Footer());

      const helpCenterLink = screen.getByText("Help Center").closest("a");
      expect(helpCenterLink).toHaveAttribute("href", "/help");

      const reportIssueLink = screen.getByText("Report an Issue").closest("a");
      expect(reportIssueLink).toHaveAttribute("href", "/help/report");
    });
  });

  describe("Copyright", () => {
    it("should display current year in copyright", async () => {
      vi.mocked(tryCatch).mockResolvedValue({
        data: mockDocumentVersions,
        error: null,
      });

      render(await Footer());

      const currentYear = new Date().getFullYear();
      const copyrightText = screen.getByText(
        `© ${currentYear} Hoador, Inc. All rights reserved`,
      );
      expect(copyrightText).toBeInTheDocument();
    });
  });
});
