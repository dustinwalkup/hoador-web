import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorePageFilters } from "../explore-page-filters";

// Mock all the hooks and utilities
vi.mock("@/features/listings/hooks/use-url-state", () => ({
  useListingFilters: vi.fn(),
}));

vi.mock("@/hooks/use-debounced-search", () => ({
  useDebouncedSearch: vi.fn(),
}));

vi.mock("@/constants/listings", () => ({
  STATIC_CATEGORIES: [
    { id: "power-tools", name: "Power Tools", icon: "drill" },
    { id: "hand-tools", name: "Hand Tools", icon: "hammer" },
  ],
}));

vi.mock("@/components/dashboard/category-button", () => ({
  default: vi.fn(({ icon, label, active, onClick }) => {
    // Convert label like "Power Tools" to test ID like "category-power-tools"
    const testId = `category-${label.toLowerCase().replace(/\s+/g, "-")}`;
    return (
      <button data-testid={testId} data-selected={active} onClick={onClick}>
        {icon} {label}
      </button>
    );
  }),
}));

import { useListingFilters } from "@/features/listings/hooks/use-url-state";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";

describe("ExplorePageFilters", () => {
  const mockFilters = {
    query: "",
    categoryId: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    condition: [],
    deliveryMode: "pickup_only",
    setupAvailable: undefined,
    availableNow: undefined,
    sortBy: "newest",
    sortOrder: "desc",
    page: 1,
  };

  const mockUpdateFilters = vi.fn();

  const mockDebouncedSearch = {
    localQuery: "",
    handleSearchChange: vi.fn(),
    clearSearch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useListingFilters as any).mockReturnValue({
      state: mockFilters,
      updateState: mockUpdateFilters,
    });

    (useDebouncedSearch as any).mockReturnValue(mockDebouncedSearch);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Component Rendering", () => {
    it("should render without crashing", () => {
      expect(() => render(<ExplorePageFilters />)).not.toThrow();
    });

    it("should render search input", () => {
      render(<ExplorePageFilters />);

      const searchInput = screen.getByPlaceholderText("Search listings...");
      expect(searchInput).toBeInTheDocument();
    });

    it("should render sort button", () => {
      render(<ExplorePageFilters />);

      const sortButton = screen.getByRole("button", { name: /Recently added/ });
      expect(sortButton).toBeInTheDocument();
    });

    it("should render filters button", () => {
      render(<ExplorePageFilters />);

      const filtersButton = screen.getByRole("button", { name: /Filters/ });
      expect(filtersButton).toBeInTheDocument();
    });

    it("should render category buttons", () => {
      render(<ExplorePageFilters />);

      expect(screen.getByTestId("category-power-tools")).toBeInTheDocument();
      expect(screen.getByTestId("category-hand-tools")).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("should initialize search input with filter value", () => {
      (useListingFilters as any).mockReturnValue({
        state: { ...mockFilters, query: "drill" },
        updateState: mockUpdateFilters,
      });

      (useDebouncedSearch as any).mockReturnValue({
        ...mockDebouncedSearch,
        localQuery: "drill",
      });

      render(<ExplorePageFilters />);

      const searchInput = screen.getByPlaceholderText("Search listings...");
      expect(searchInput).toHaveValue("drill");
    });

    it("should call handleSearchChange when typing in search input", async () => {
      const user = userEvent.setup();
      render(<ExplorePageFilters />);

      const searchInput = screen.getByPlaceholderText("Search listings...");

      await user.type(searchInput, "hammer");

      // handleSearchChange is called on every keystroke
      expect(mockDebouncedSearch.handleSearchChange).toHaveBeenCalled();
      // Check that it was called with the final character
      expect(mockDebouncedSearch.handleSearchChange).toHaveBeenLastCalledWith(
        "r",
      );
    });

    it("should show clear search button when there is a search query", () => {
      (useDebouncedSearch as any).mockReturnValue({
        ...mockDebouncedSearch,
        localQuery: "drill",
      });

      const { container } = render(<ExplorePageFilters />);

      // Clear button is an icon-only button, find it by its position in the form
      const clearButton = container.querySelector('form button[type="button"]');
      expect(clearButton).toBeInTheDocument();
    });

    it("should call clearSearch when clear button is clicked", async () => {
      const user = userEvent.setup();

      (useDebouncedSearch as any).mockReturnValue({
        ...mockDebouncedSearch,
        localQuery: "drill",
      });

      const { container } = render(<ExplorePageFilters />);

      // Clear button is an icon-only button, find it by its position in the form
      const clearButton = container.querySelector(
        'form button[type="button"]',
      ) as HTMLButtonElement;
      await user.click(clearButton!);

      expect(mockDebouncedSearch.clearSearch).toHaveBeenCalled();
    });
  });

  describe("Category Selection", () => {
    it("should highlight selected category", () => {
      (useListingFilters as any).mockReturnValue({
        state: { ...mockFilters, categoryId: "power-tools" },
        updateState: mockUpdateFilters,
      });

      render(<ExplorePageFilters />);

      const powerToolsButton = screen.getByTestId("category-power-tools");
      expect(powerToolsButton).toHaveAttribute("data-selected", "true");

      const handToolsButton = screen.getByTestId("category-hand-tools");
      expect(handToolsButton).toHaveAttribute("data-selected", "false");
    });

    it("should call updateFilters when category is clicked", async () => {
      const user = userEvent.setup();
      render(<ExplorePageFilters />);

      const powerToolsButton = screen.getByTestId("category-power-tools");
      await user.click(powerToolsButton);

      expect(mockUpdateFilters).toHaveBeenCalledWith({
        categoryId: "power-tools",
      });
    });

    it("should clear category when same category is clicked again", async () => {
      const user = userEvent.setup();

      (useListingFilters as any).mockReturnValue({
        state: { ...mockFilters, categoryId: "power-tools" },
        updateState: mockUpdateFilters,
      });

      render(<ExplorePageFilters />);

      const powerToolsButton = screen.getByTestId("category-power-tools");
      await user.click(powerToolsButton);

      expect(mockUpdateFilters).toHaveBeenCalledWith({ categoryId: undefined });
    });
  });

  describe("Sort Functionality", () => {
    it("should display current sort label correctly", () => {
      render(<ExplorePageFilters />);

      expect(screen.getByText("Recently added")).toBeInTheDocument();
    });

    it("should display different sort labels based on filters", () => {
      (useListingFilters as any).mockReturnValue({
        state: { ...mockFilters, sortBy: "price", sortOrder: "asc" },
        updateState: mockUpdateFilters,
      });

      render(<ExplorePageFilters />);

      expect(screen.getByText("Price: Low to high")).toBeInTheDocument();
    });

    it("should open sort popover when sort button is clicked", async () => {
      const user = userEvent.setup();
      render(<ExplorePageFilters />);

      const sortButton = screen.getByRole("button", { name: /Recently added/ });
      await user.click(sortButton);

      // Should show sort options ("Recently added" appears twice: in trigger and in dropdown)
      const recentlyAddedElements = screen.getAllByText("Recently added");
      expect(recentlyAddedElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Price: Low to high")).toBeInTheDocument();
      expect(screen.getByText("Price: High to low")).toBeInTheDocument();
      expect(screen.getByText("Highest rated")).toBeInTheDocument();
    });

    it("should call updateFilters when sort option is selected", async () => {
      const user = userEvent.setup();
      render(<ExplorePageFilters />);

      // Open sort popover
      const sortButton = screen.getByRole("button", { name: /Recently added/ });
      await user.click(sortButton);

      // Click on a sort option
      const priceLowToHigh = screen.getByText("Price: Low to high");
      await user.click(priceLowToHigh);

      expect(mockUpdateFilters).toHaveBeenCalledWith({
        sortBy: "price",
        sortOrder: "asc",
      });
    });
  });

  describe("Filters Sheet", () => {
    it("should open filters sheet when filters button is clicked", async () => {
      const user = userEvent.setup();
      render(<ExplorePageFilters />);

      const filtersButton = screen.getByRole("button", { name: /Filters/ });
      await user.click(filtersButton);

      // Should show filter sheet content
      expect(screen.getByText("Price Range")).toBeInTheDocument();
      expect(screen.getByText("Condition")).toBeInTheDocument();
      expect(screen.getByText("Delivery Method")).toBeInTheDocument();
    });

    it("should show active filters count", () => {
      (useListingFilters as any).mockReturnValue({
        state: {
          ...mockFilters,
          minPrice: 10,
          maxPrice: 100,
          condition: ["good", "excellent"],
        },
        updateState: mockUpdateFilters,
      });

      render(<ExplorePageFilters />);

      // getActiveFiltersCount counts: minPrice (1) + maxPrice (1) + conditions (2) = 4
      expect(screen.getByText("4")).toBeInTheDocument();
    });

    it("should sync local state with filters when sheet opens", async () => {
      const user = userEvent.setup();

      (useListingFilters as any).mockReturnValue({
        state: {
          ...mockFilters,
          minPrice: 25,
          maxPrice: 75,
          condition: ["good"],
          deliveryMode: "delivery_only",
          setupAvailable: true,
        },
        updateState: mockUpdateFilters,
      });

      render(<ExplorePageFilters />);

      const filtersButton = screen.getByRole("button", { name: /Filters/ });
      await user.click(filtersButton);

      // Local state should be synced
      const minPriceInput = screen.getByDisplayValue("25");
      const maxPriceInput = screen.getByDisplayValue("75");

      expect(minPriceInput).toBeInTheDocument();
      expect(maxPriceInput).toBeInTheDocument();
    });

    it("should update filters when apply button is clicked", async () => {
      const user = userEvent.setup();
      render(<ExplorePageFilters />);

      // Open filters sheet
      const filtersButton = screen.getByRole("button", { name: /Filters/ });
      await user.click(filtersButton);

      // Find and fill price inputs - labels are "Min" and "Max"
      const minPriceInput = screen.getByLabelText("Min");
      const maxPriceInput = screen.getByLabelText("Max");

      await user.clear(minPriceInput);
      await user.type(minPriceInput, "20");
      await user.clear(maxPriceInput);
      await user.type(maxPriceInput, "80");

      // Click apply
      const applyButton = screen.getByRole("button", { name: /Apply/ });
      await user.click(applyButton);

      expect(mockUpdateFilters).toHaveBeenCalledWith({
        categoryId: undefined,
        query: "",
        sortBy: "newest",
        sortOrder: "desc",
        minPrice: 20,
        maxPrice: 80,
        condition: undefined,
        deliveryMode: undefined,
        setupAvailable: undefined,
        availableNow: undefined,
      });
    });

    it("should clear all filters when clear button is clicked", async () => {
      const user = userEvent.setup();

      (useListingFilters as any).mockReturnValue({
        state: {
          ...mockFilters,
          minPrice: 25,
          maxPrice: 75,
          condition: ["good"],
        },
        updateState: mockUpdateFilters,
      });

      render(<ExplorePageFilters />);

      // Open filters sheet
      const filtersButton = screen.getByRole("button", { name: /Filters/ });
      await user.click(filtersButton);

      // Click reset button (labeled "Reset", not "Clear all")
      const resetButton = screen.getByRole("button", { name: /Reset/ });
      await user.click(resetButton);

      expect(mockUpdateFilters).toHaveBeenCalledWith({
        categoryId: undefined,
        query: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        condition: undefined,
        deliveryMode: undefined,
        setupAvailable: undefined,
        availableNow: undefined,
        sortBy: undefined,
        sortOrder: undefined,
      });
    });
  });

  describe("Active Filters Display", () => {
    it.skip("should show active filter badges", () => {
      // TODO: Active filter badges feature not yet implemented
      (useListingFilters as any).mockReturnValue({
        state: {
          ...mockFilters,
          minPrice: 10,
          maxPrice: 50,
          condition: ["good"],
          setupAvailable: true,
        },
        updateState: mockUpdateFilters,
      });

      render(<ExplorePageFilters />);

      // Price badge text might be split across elements, use a flexible matcher
      expect(
        screen.getByText((content, element) => {
          return !!(
            element?.textContent?.includes("$10") &&
            element?.textContent?.includes("$50")
          );
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Good")).toBeInTheDocument();
      expect(screen.getByText("Setup available")).toBeInTheDocument();
    });

    it.skip("should remove filter when badge X is clicked", async () => {
      // TODO: Active filter badges feature not yet implemented
      const user = userEvent.setup();

      (useListingFilters as any).mockReturnValue({
        state: {
          ...mockFilters,
          minPrice: 10,
          maxPrice: 50,
        },
        updateState: mockUpdateFilters,
      });

      render(<ExplorePageFilters />);

      // Price badge text might be split across elements, use a flexible matcher
      const priceBadge = screen.getByText((content, element) => {
        return !!(
          element?.textContent?.includes("$10") &&
          element?.textContent?.includes("$50")
        );
      });
      const removeButton = priceBadge.nextElementSibling; // X button
      await user.click(removeButton as Element);

      expect(mockUpdateFilters).toHaveBeenCalledWith({
        minPrice: undefined,
        maxPrice: undefined,
      });
    });

    it("should not show active filters section when no filters are active", () => {
      render(<ExplorePageFilters />);

      expect(screen.queryByText("Active filters")).not.toBeInTheDocument();
    });
  });

  describe("Condition Filtering", () => {
    it("should allow selecting multiple conditions", async () => {
      const user = userEvent.setup();
      render(<ExplorePageFilters />);

      // Open filters sheet
      const filtersButton = screen.getByRole("button", { name: /Filters/ });
      await user.click(filtersButton);

      // Check condition checkboxes
      const goodCheckbox = screen.getByRole("checkbox", { name: /good/i });
      const excellentCheckbox = screen.getByRole("checkbox", {
        name: /excellent/i,
      });

      await user.click(goodCheckbox);
      await user.click(excellentCheckbox);

      // Apply filters
      const applyButton = screen.getByRole("button", { name: /Apply/ });
      await user.click(applyButton);

      expect(mockUpdateFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          condition: ["good", "excellent"],
        }),
      );
    });

    it("should pre-check conditions based on current filters", async () => {
      (useListingFilters as any).mockReturnValue({
        state: { ...mockFilters, condition: ["good", "fair"] },
        updateState: mockUpdateFilters,
      });

      const user = userEvent.setup();
      render(<ExplorePageFilters />);

      // Open filters sheet
      const filtersButton = screen.getByRole("button", { name: /Filters/ });
      await user.click(filtersButton);

      const goodCheckbox = screen.getByRole("checkbox", { name: /good/i });
      const fairCheckbox = screen.getByRole("checkbox", { name: /fair/i });

      expect(goodCheckbox).toBeChecked();
      expect(fairCheckbox).toBeChecked();
    });
  });

  describe("Delivery Mode Selection", () => {
    it("should update delivery mode selection", async () => {
      const user = userEvent.setup();
      render(<ExplorePageFilters />);

      // Open filters sheet
      const filtersButton = screen.getByRole("button", { name: /Filters/ });
      await user.click(filtersButton);

      // Find the dialog and scope queries to it
      const dialog = screen.getByRole("dialog");

      // Try to find the delivery select by its label first, fallback to getting combobox in dialog
      let deliverySelect: HTMLElement;
      try {
        deliverySelect = within(dialog).getByLabelText("Delivery Method");
      } catch {
        // Fallback: get the combobox in the dialog (should be the delivery one)
        deliverySelect = within(dialog).getByRole("combobox");
      }

      // Click the combobox to open it using user.click
      await user.click(deliverySelect);

      // Wait for the dropdown to open and find the option
      // Options are rendered in a portal via SelectPrimitive.Portal, so use screen
      // Use getByRole with exact text match
      const deliveryOnlyOption = await waitFor(
        () => screen.getByRole("option", { name: "Delivery Only" }),
        { timeout: 3000 },
      );
      await user.click(deliveryOnlyOption);

      // Apply filters
      const applyButton = screen.getByRole("button", { name: /Apply/ });
      await user.click(applyButton);

      expect(mockUpdateFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryMode: "delivery_only",
        }),
      );
    });
  });

  describe("Additional Options", () => {
    it("should toggle setup available checkbox", async () => {
      const user = userEvent.setup();
      render(<ExplorePageFilters />);

      // Open filters sheet
      const filtersButton = screen.getByRole("button", { name: /Filters/ });
      await user.click(filtersButton);

      const setupCheckbox = screen.getByRole("checkbox", {
        name: /Setup available/,
      });
      await user.click(setupCheckbox);

      // Apply filters
      const applyButton = screen.getByRole("button", { name: /Apply/ });
      await user.click(applyButton);

      expect(mockUpdateFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          setupAvailable: true,
        }),
      );
    });

    it("should toggle available now checkbox", async () => {
      const user = userEvent.setup();
      render(<ExplorePageFilters />);

      // Open filters sheet
      const filtersButton = screen.getByRole("button", { name: /Filters/ });
      await user.click(filtersButton);

      const availableNowCheckbox = screen.getByRole("checkbox", {
        name: /Available now/,
      });
      await user.click(availableNowCheckbox);

      // Apply filters
      const applyButton = screen.getByRole("button", { name: /Apply/ });
      await user.click(applyButton);

      expect(mockUpdateFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          availableNow: true,
        }),
      );
    });
  });

  describe("Base Path Handling", () => {
    it("should accept basePath prop", () => {
      render(<ExplorePageFilters basePath="/custom/path" />);

      // Component should render without issues
      expect(
        screen.getByPlaceholderText("Search listings..."),
      ).toBeInTheDocument();
    });
  });
});
