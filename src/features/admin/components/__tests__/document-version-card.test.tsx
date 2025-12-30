import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentVersionCard } from "../document-version-card";
import {
  mockCurrentDocumentVersion,
  mockDocumentVersions,
} from "@/test/fixtures/legal-documents";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

// Mock useRouter for LegalDocumentHistory component
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  })),
}));

// Mock window.open
const mockWindowOpen = vi.fn();
window.open = mockWindowOpen;

describe("DocumentVersionCard", () => {
  const mockMetadata = {
    name: "Terms of Service",
    category: "Core Legal",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render document name and metadata", () => {
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={mockDocumentVersions}
          isPublished={true}
        />,
      );

      expect(screen.getByText("Terms of Service")).toBeInTheDocument();
    });

    it("should render current version information", () => {
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={mockDocumentVersions}
          isPublished={true}
        />,
      );

      expect(screen.getByText(/v1\.0/i)).toBeInTheDocument();
    });

    it("should render published date", () => {
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={mockDocumentVersions}
          isPublished={true}
        />,
      );

      // Published date should be rendered (formatted with toLocaleDateString)
      expect(screen.getByText(/2024/)).toBeInTheDocument();
    });

    it("should render published badge when published", () => {
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={mockDocumentVersions}
          isPublished={true}
        />,
      );

      expect(screen.getByText("Published")).toBeInTheDocument();
    });

    it("should render 'Not Published' badge when not published", () => {
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={mockDocumentVersions}
          isPublished={false}
        />,
      );

      expect(screen.getByText("Not Published")).toBeInTheDocument();
    });

    it("should render view button for current version", () => {
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={mockDocumentVersions}
          isPublished={true}
        />,
      );

      expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
    });

    it("should render history button when versions exist", () => {
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={mockDocumentVersions}
          isPublished={true}
        />,
      );

      expect(
        screen.getByRole("button", { name: /history/i }),
      ).toBeInTheDocument();
    });

    it("should show 'No version published' when no current version", () => {
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={null}
          versions={[]}
          isPublished={false}
        />,
      );

      expect(screen.getByText("No version published")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should open document in new tab when view button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={mockDocumentVersions}
          isPublished={true}
        />,
      );

      const viewButton = screen.getByRole("button", { name: /view/i });
      await user.click(viewButton);

      expect(mockWindowOpen).toHaveBeenCalledWith(
        mockCurrentDocumentVersion.url,
        "_blank",
      );
    });

    it("should expand history when history button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={mockDocumentVersions}
          isPublished={true}
        />,
      );

      const historyButton = screen.getByRole("button", { name: /history/i });

      // Initially collapsed
      expect(historyButton).toHaveAttribute("aria-expanded", "false");

      await user.click(historyButton);

      // Should be expanded after click
      expect(historyButton).toHaveAttribute("aria-expanded", "true");

      // History content should eventually be visible
      await waitFor(() => {
        expect(screen.getByText("Version History")).toBeInTheDocument();
      });
    });

    it("should collapse history when history button is clicked again", async () => {
      const user = userEvent.setup();
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={mockDocumentVersions}
          isPublished={true}
        />,
      );

      const historyButton = screen.getByRole("button", { name: /history/i });

      // Expand first
      await user.click(historyButton);
      expect(historyButton).toHaveAttribute("aria-expanded", "true");

      // Click again to collapse
      await user.click(historyButton);
      expect(historyButton).toHaveAttribute("aria-expanded", "false");
    });

    it("should show version list when history is expanded", async () => {
      const user = userEvent.setup();
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={mockDocumentVersions}
          isPublished={true}
        />,
      );

      const historyButton = screen.getByRole("button", { name: /history/i });
      await user.click(historyButton);

      // Version list should be visible after expansion
      await waitFor(() => {
        expect(screen.getByText(/version 2\.0/i)).toBeInTheDocument();
        expect(screen.getByText(/version 1\.0/i)).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty versions array", () => {
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={mockCurrentDocumentVersion}
          versions={[]}
          isPublished={true}
        />,
      );

      // Should not render history button when no versions
      expect(
        screen.queryByRole("button", { name: /history/i }),
      ).not.toBeInTheDocument();
    });

    it("should handle null current version", () => {
      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={null}
          versions={mockDocumentVersions}
          isPublished={false}
        />,
      );

      expect(screen.getByText("No version published")).toBeInTheDocument();
      // View button should not be rendered when no current version
      expect(
        screen.queryByRole("button", { name: /view/i }),
      ).not.toBeInTheDocument();
    });

    it("should highlight current version in history", async () => {
      const user = userEvent.setup();
      const currentVersion = {
        ...mockCurrentDocumentVersion,
        version: "2.0",
      };

      render(
        <DocumentVersionCard
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          metadata={mockMetadata}
          currentVersion={currentVersion}
          versions={mockDocumentVersions}
          isPublished={true}
        />,
      );

      const historyButton = screen.getByRole("button", { name: /history/i });
      await user.click(historyButton);

      // Current version should have "Current" badge in the history
      await waitFor(() => {
        expect(screen.getAllByText("Current")).toHaveLength(1);
      });
    });
  });
});
