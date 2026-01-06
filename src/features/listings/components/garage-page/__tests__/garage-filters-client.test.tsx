import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GarageFiltersClient } from "../garage-filters-client";

// Mock all dependencies
vi.mock("@/features/listings/hooks/use-garage", () => ({
  useGarageFilters: vi.fn(),
  useGarageCategories: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  debounce: vi.fn((fn) => fn),
}));

vi.mock("@/constants/garage", () => ({
  emojiMap: {
    drill: "🔧",
    hammer: "🔨",
  },
}));

// vi.mock("./garage-loading-skeleton", () => ({
//   GarageFiltersLoadingSkeleton: vi.fn(() => <div data-testid="loading-skeleton" />),
// }));

vi.mock("@/features/listings/components/garage-page/garage-error", () => ({
  GarageFiltersError: vi.fn(({ error, onRetry }) => (
    <div>
      <div>Failed to load filters. {error.message}</div>
      <button onClick={onRetry}>Retry</button>
    </div>
  )),
}));

import {
  useGarageFilters,
  useGarageCategories,
} from "@/features/listings/hooks/use-garage";
// import { GarageFiltersLoadingSkeleton } from "./garage-loading-skeleton";
// import { GarageFiltersError } from "./garage-error"; // Now mocked

describe("GarageFiltersClient", () => {
  const mockFilters = {
    query: "",
    categoryId: undefined,
    sortBy: "newest" as const,
    sortOrder: "desc" as const,
    rentalStatus: undefined,
  };

  const mockCategories = [
    { id: "power-tools", name: "Power Tools", icon: "drill" },
    { id: "hand-tools", name: "Hand Tools", icon: "hammer" },
  ];

  const mockUpdateFilters = vi.fn();

  const mockUseGarageFilters = {
    filters: mockFilters,
    updateFilters: mockUpdateFilters,
  };

  const mockUseGarageCategories = {
    data: mockCategories,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.clearAllMocks();

    (useGarageFilters as any).mockReturnValue(mockUseGarageFilters);
    (useGarageCategories as any).mockReturnValue(mockUseGarageCategories);
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllTimers();
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );
  };

  describe("Component Rendering", () => {
    it("should render without crashing", () => {
      expect(() =>
        renderWithQueryClient(<GarageFiltersClient currentTab="active" />),
      ).not.toThrow();
    });

    it("should render search input", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      const searchInput = screen.getByPlaceholderText("Search Listings...");
      expect(searchInput).toBeInTheDocument();
    });

    it("should render sort dropdown", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Should render the sort select with "Newest" as default
      expect(screen.getByText("Newest")).toBeInTheDocument();
    });

    it("should render category dropdown", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Should render the category select with "All Categories" as default
      expect(screen.getByText("All Categories")).toBeInTheDocument();
    });

    it("should render rental status filter only for active tab", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Should render the rental status select with "All Listings" as default
      expect(screen.getByText("All Listings")).toBeInTheDocument();
    });

    it("should not render rental status filter for inactive tab", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="inactive" />);

      // Should not render rental status options
      expect(screen.queryByText("All Listings")).not.toBeInTheDocument();
      expect(screen.queryByText("Available")).not.toBeInTheDocument();
      expect(screen.queryByText("Rented")).not.toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("should render loading skeleton when categories are loading", () => {
      (useGarageCategories as any).mockReturnValue({
        ...mockUseGarageCategories,
        isLoading: true,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Should render skeleton elements
      const skeletons = screen
        .getAllByRole("generic")
        .filter((element) => element.getAttribute("data-slot") === "skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("should render error component when categories fail to load", () => {
      const mockError = new Error("Failed to load categories");
      (useGarageCategories as any).mockReturnValue({
        ...mockUseGarageCategories,
        error: mockError,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      expect(
        screen.getByText("Failed to load filters. Failed to load categories"),
      ).toBeInTheDocument();
    });

    it("should call refetch when retry button is clicked", async () => {
      const user = userEvent.setup();
      const mockError = new Error("Network error");
      (useGarageCategories as any).mockReturnValue({
        ...mockUseGarageCategories,
        error: mockError,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      const retryButton = screen.getByRole("button", { name: /retry/i });
      await user.click(retryButton);

      expect(mockUseGarageCategories.refetch).toHaveBeenCalled();
    });
  });

  describe("Search Functionality", () => {
    it("should initialize search input with filter value", () => {
      (useGarageFilters as any).mockReturnValue({
        filters: { ...mockFilters, query: "drill" },
        updateFilters: mockUpdateFilters,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      const searchInput = screen.getByPlaceholderText("Search Listings...");
      expect(searchInput).toHaveValue("drill");
    });

    it("should update search query state when typing", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      const searchInput = screen.getByPlaceholderText("Search Listings...");
      await user.type(searchInput, "hammer");

      expect(searchInput).toHaveValue("hammer");
    });

    it("should call updateFilters with debounced search", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      const searchInput = screen.getByPlaceholderText("Search Listings...");
      await user.type(searchInput, "drill");

      // Wait for debounce
      await waitFor(() => {
        expect(mockUpdateFilters).toHaveBeenCalledWith({ query: "drill" });
      });
    });

    it("should show clear search button when there is search query", () => {
      (useGarageFilters as any).mockReturnValue({
        filters: { ...mockFilters, query: "test" },
        updateFilters: mockUpdateFilters,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      const clearButton = screen.getByRole("button", { name: /Clear search/ });
      expect(clearButton).toBeInTheDocument();
    });

    it("should clear search when clear button is clicked", async () => {
      const user = userEvent.setup();

      (useGarageFilters as any).mockReturnValue({
        filters: { ...mockFilters, query: "test" },
        updateFilters: mockUpdateFilters,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      const clearButton = screen.getByRole("button", { name: /Clear search/ });
      await user.click(clearButton);

      expect(mockUpdateFilters).toHaveBeenCalledWith({ query: undefined });
    });
  });

  describe("Sort Functionality", () => {
    it("should display current sort value correctly", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Find the sort combobox by finding the "Newest" text and getting the closest combobox button
      const sortText = screen.getByText("Newest");
      const sortSelect = sortText.closest('button[role="combobox"]');
      expect(sortSelect).toBeInTheDocument();
      expect(sortSelect).toHaveTextContent("Newest");
    });

    it("should update sort when option is selected", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Click on the sort button to open dropdown - find the button that contains the text
      const sortText = screen.getByText("Newest");
      const sortButton = sortText.closest('button[role="combobox"]');
      if (!sortButton) throw new Error("Sort button not found");
      await user.click(sortButton);

      // Select the A-Z option
      const nameAscOption = await waitFor(() =>
        screen.getByRole("option", { name: /A–Z/i }),
      );
      await user.click(nameAscOption);

      expect(mockUpdateFilters).toHaveBeenCalledWith({
        sortBy: "name",
        sortOrder: "asc",
      });
    });

    it("should handle different sort combinations", async () => {
      const user = userEvent.setup();

      (useGarageFilters as any).mockReturnValue({
        filters: { ...mockFilters, sortBy: "name", sortOrder: "desc" },
        updateFilters: mockUpdateFilters,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Should display "Z–A" for name desc - find the button that contains the text
      const sortText = screen.getByText("Z–A");
      const sortButton = sortText.closest('button[role="combobox"]');
      if (!sortButton) throw new Error("Sort button not found");
      await user.click(sortButton);

      // Select the Newest option
      const newestOption = await waitFor(() =>
        screen.getByRole("option", { name: /Newest/i }),
      );
      await user.click(newestOption);

      expect(mockUpdateFilters).toHaveBeenCalledWith({
        sortBy: "newest",
        sortOrder: "desc",
      });
    });
  });

  describe("Category Filtering", () => {
    it("should display 'All Categories' when no category is selected", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      expect(screen.getByText("All Categories")).toBeInTheDocument();
    });

    it("should display selected category with emoji", () => {
      (useGarageFilters as any).mockReturnValue({
        filters: { ...mockFilters, categoryId: "power-tools" },
        updateFilters: mockUpdateFilters,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      expect(screen.getByText("🔧 Power Tools")).toBeInTheDocument();
    });

    it("should update category when option is selected", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Click on category button to open dropdown - find the button that contains the text
      const categoryText = screen.getByText("All Categories");
      const categoryButton = categoryText.closest('button[role="combobox"]');
      if (!categoryButton) throw new Error("Category button not found");
      await user.click(categoryButton);

      // Select the Hand Tools option
      const handToolsOption = await waitFor(() =>
        screen.getByText("🔨 Hand Tools"),
      );
      await user.click(handToolsOption);

      expect(mockUpdateFilters).toHaveBeenCalledWith({
        categoryId: "hand-tools",
      });
    });

    it("should clear category when 'All Categories' is selected", async () => {
      const user = userEvent.setup();

      (useGarageFilters as any).mockReturnValue({
        filters: { ...mockFilters, categoryId: "power-tools" },
        updateFilters: mockUpdateFilters,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Click on the selected category to open dropdown - find the button that contains the text
      const categoryText = screen.getByText("🔧 Power Tools");
      const categoryButton = categoryText.closest('button[role="combobox"]');
      if (!categoryButton) throw new Error("Category button not found");
      await user.click(categoryButton);

      // Select All Categories option
      const allCategoriesOption = await waitFor(() =>
        screen.getByRole("option", { name: /All Categories/i }),
      );
      await user.click(allCategoriesOption);

      expect(mockUpdateFilters).toHaveBeenCalledWith({
        categoryId: undefined,
      });
    });
  });

  describe("Rental Status Filtering", () => {
    it("should display 'All Listings' when no rental status is selected", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      expect(screen.getByText("All Listings")).toBeInTheDocument();
    });

    it("should display selected rental status with emoji", () => {
      (useGarageFilters as any).mockReturnValue({
        filters: { ...mockFilters, rentalStatus: "available" },
        updateFilters: mockUpdateFilters,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      expect(screen.getByText("✅ Available")).toBeInTheDocument();
    });

    it("should update rental status when option is selected", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Click on rental status button to open dropdown - find the button that contains the text
      const rentalStatusText = screen.getByText("All Listings");
      const rentalStatusButton = rentalStatusText.closest(
        'button[role="combobox"]',
      );
      if (!rentalStatusButton)
        throw new Error("Rental status button not found");
      await user.click(rentalStatusButton);

      // Select the Rented option
      const rentedOption = await waitFor(() =>
        screen.getByRole("option", { name: /🔄 Rented/i }),
      );
      await user.click(rentedOption);

      expect(mockUpdateFilters).toHaveBeenCalledWith({
        rentalStatus: "rented",
      });
    });

    it("should clear rental status when 'All Listings' is selected", async () => {
      const user = userEvent.setup();

      (useGarageFilters as any).mockReturnValue({
        filters: { ...mockFilters, rentalStatus: "available" },
        updateFilters: mockUpdateFilters,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Click on the selected rental status to open dropdown - find the button that contains the text
      const rentalStatusText = screen.getByText("✅ Available");
      const rentalStatusButton = rentalStatusText.closest(
        'button[role="combobox"]',
      );
      if (!rentalStatusButton)
        throw new Error("Rental status button not found");
      await user.click(rentalStatusButton);

      // Select All Listings option
      const allListingsOption = await waitFor(() =>
        screen.getByRole("option", { name: /All Listings/i }),
      );
      await user.click(allListingsOption);

      expect(mockUpdateFilters).toHaveBeenCalledWith({
        rentalStatus: undefined,
      });
    });
  });

  describe("Display Name Functions", () => {
    it("should format category display name with emoji", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Click on category button to open dropdown - find the button that contains the text
      const categoryText = screen.getByText("All Categories");
      const categoryButton = categoryText.closest('button[role="combobox"]');
      if (!categoryButton) throw new Error("Category button not found");
      await user.click(categoryButton);

      await waitFor(() => {
        expect(screen.getByText("🔧 Power Tools")).toBeInTheDocument();
        expect(screen.getByText("🔨 Hand Tools")).toBeInTheDocument();
      });
    });

    it("should format category display name without emoji when icon not found", async () => {
      const user = userEvent.setup();
      const categoriesWithUnknownIcon = [
        { id: "unknown", name: "Unknown Category", icon: "unknown-icon" },
      ];

      (useGarageCategories as any).mockReturnValue({
        data: categoriesWithUnknownIcon,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Find the category select button by finding the button that contains "All Categories"
      const categoryText = screen.getByText("All Categories");
      const categorySelect = categoryText.closest('button[role="combobox"]');
      if (!categorySelect) throw new Error("Category select not found");
      await user.click(categorySelect);

      await waitFor(() => {
        expect(screen.getByText("Unknown Category")).toBeInTheDocument();
      });
    });

    it("should format rental status display name", async () => {
      const user = userEvent.setup();
      // Test the helper function indirectly through the component
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Find the rental status select button by finding the button that contains "All Listings"
      const rentalStatusText = screen.getByText("All Listings");
      const rentalStatusSelect = rentalStatusText.closest(
        'button[role="combobox"]',
      );
      if (!rentalStatusSelect)
        throw new Error("Rental status select not found");
      await user.click(rentalStatusSelect);

      await waitFor(() => {
        // "All Listings" appears twice: in trigger and in dropdown option
        const allListingsElements = screen.getAllByText("All Listings");
        expect(allListingsElements.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("✅ Available")).toBeInTheDocument();
        expect(screen.getByText("🔄 Rented")).toBeInTheDocument();
      });
    });
  });

  describe("Styling and Layout", () => {
    it("should have correct container styling", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Find the container by finding the div that contains the search input
      const searchInput = screen.getByPlaceholderText("Search Listings...");
      const container = searchInput.closest(".mt-6.flex.flex-col");
      expect(container).toHaveClass(
        "mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
      );
    });

    it("should have correct search input styling", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Find the search container by finding the div that contains the search input
      const searchInput = screen.getByPlaceholderText("Search Listings...");
      const searchContainer = searchInput.parentElement;
      expect(searchContainer).toHaveClass(
        "relative flex w-full max-w-sm items-center",
      );

      expect(searchInput).toHaveClass("pr-8 pl-9");
    });

    it("should have correct controls styling", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Find the controls container by finding the div that contains all the select elements
      const newestButton = screen.getByText("Newest");
      const controlsContainer = newestButton.parentElement?.parentElement;

      expect(controlsContainer).toHaveClass(
        "flex items-center justify-between gap-2 md:justify-start",
      );
    });

    it("should hide rental status filter on mobile", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Find the rental status select by its displayed text
      const rentalStatusSelect = screen.getByText("All Listings");
      const selectElement = rentalStatusSelect.closest('[role="combobox"]');
      expect(selectElement).toHaveClass("hidden h-9 w-[140px] md:flex");
    });
  });

  describe("Accessibility", () => {
    it("should have accessible search input", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      const searchInput = screen.getByPlaceholderText("Search Listings...");
      expect(searchInput).toBeInTheDocument();
      expect(searchInput.tagName.toLowerCase()).toBe("input");
    });

    it("should have screen reader text for clear button", () => {
      (useGarageFilters as any).mockReturnValue({
        filters: { ...mockFilters, query: "test" },
        updateFilters: mockUpdateFilters,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      const clearButton = screen.getByRole("button", { name: /Clear search/ });
      expect(clearButton).toBeInTheDocument();
    });

    it("should have proper select labels", () => {
      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Should have sort, category, and rental status selects
      const selects = screen.getAllByRole("combobox");
      expect(selects.length).toBe(3); // sort, category, rental status
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty categories array", async () => {
      const user = userEvent.setup();
      (useGarageCategories as any).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      // Click on category button to open dropdown - find the button that contains the text
      const categoryText = screen.getByText("All Categories");
      const categoryButton = categoryText.closest('button[role="combobox"]');
      if (!categoryButton) throw new Error("Category button not found");
      await user.click(categoryButton);

      // Should only show "All Categories" option (appears twice: in trigger and in dropdown)
      await waitFor(() => {
        const allCategoriesElements = screen.getAllByText("All Categories");
        expect(allCategoriesElements.length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.queryByText("Power Tools")).not.toBeInTheDocument();
    });

    it("should handle null categories data", () => {
      (useGarageCategories as any).mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      expect(() =>
        renderWithQueryClient(<GarageFiltersClient currentTab="active" />),
      ).not.toThrow();
    });

    it("should handle sort value parsing correctly", () => {
      (useGarageFilters as any).mockReturnValue({
        filters: { ...mockFilters, sortBy: "lastRented", sortOrder: "desc" },
        updateFilters: mockUpdateFilters,
      });

      renderWithQueryClient(<GarageFiltersClient currentTab="active" />);

      expect(screen.getByText("Last Rented")).toBeInTheDocument();
    });
  });
});
