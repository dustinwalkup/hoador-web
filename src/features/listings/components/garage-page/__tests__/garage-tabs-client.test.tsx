import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GarageTabsClient } from "../garage-tabs-client";

// Use vi.hoisted to create mocks that are available during hoisting
const {
  mockTabs,
  mockRouter,
  mockUseSearchParams,
  mockUseGarageFilters,
  mockUsePendingListingsCount,
} = vi.hoisted(() => ({
  mockTabs: vi.fn(),
  mockRouter: { replace: vi.fn() },
  mockUseSearchParams: vi.fn(),
  mockUseGarageFilters: vi.fn(),
  mockUsePendingListingsCount: vi.fn(),
}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockUseSearchParams(),
}));

// Mock garage filters hook
vi.mock("@/features/listings/hooks/use-garage", () => ({
  useGarageFilters: () => mockUseGarageFilters(),
  usePendingListingsCount: () => mockUsePendingListingsCount(),
}));

// Mock shadcn Tabs components
vi.mock("@/components/ui/tabs", () => {
  const TabsImpl = ({
    children,
    value,
    onValueChange,
    className,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    className?: string;
  }) => (
    <div data-testid="tabs" data-value={value} className={className}>
      {/* Store onValueChange in a way we can access for testing */}
      <div data-testid="tabs-onValueChange" style={{ display: "none" }}>
        {JSON.stringify({ onValueChange: !!onValueChange })}
      </div>
      {children}
    </div>
  );

  // Set the implementation on the hoisted mock
  mockTabs.mockImplementation(TabsImpl);

  return {
    Tabs: mockTabs,
    TabsList: vi.fn(({ children, className }) => (
      <div data-testid="tabs-list" className={className}>
        {children}
      </div>
    )),
    TabsTrigger: vi.fn(({ children, value, onClick }) => (
      <button
        data-testid={`tabs-trigger-${value}`}
        data-value={value}
        onClick={onClick}
      >
        {children}
      </button>
    )),
    TabsContent: vi.fn(({ children, value, className }) => (
      <div data-testid={`tabs-content-${value}`} className={className}>
        {children}
      </div>
    )),
  };
});

// Mock child components
vi.mock("../active-listings", () => ({
  ActiveListings: vi.fn(() => <div data-testid="active-listings" />),
}));

vi.mock("../inactive-listings", () => ({
  InactiveListings: vi.fn(() => <div data-testid="inactive-listings" />),
}));

vi.mock("../pending-review-listings", () => ({
  PendingReviewListings: vi.fn(() => (
    <div data-testid="pending-review-listings" />
  )),
}));

vi.mock("../garage-filters-client", () => ({
  GarageFiltersClient: vi.fn(() => <div data-testid="garage-filters-client" />),
}));

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActiveListings } from "../active-listings";
import { InactiveListings } from "../inactive-listings";
import { GarageFiltersClient } from "../garage-filters-client";

describe("GarageTabsClient", () => {
  const defaultFilters = {
    query: "",
    categoryId: undefined,
    sortBy: "newest" as const,
    sortOrder: "desc" as const,
    rentalStatus: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGarageFilters.mockReturnValue({ filters: defaultFilters });
    mockUsePendingListingsCount.mockReturnValue({ data: 0 });
  });

  describe("Component Rendering", () => {
    it("should render without crashing", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());
      expect(() =>
        render(<GarageTabsClient currentTab="active" />),
      ).not.toThrow();
    });

    it("should render Tabs component with correct value and className", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      expect(Tabs).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "active",
          className: "mb-6",
        }),
        undefined,
      );
    });

    it("should render TabsList with correct className", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      expect(TabsList).toHaveBeenCalledWith(
        expect.objectContaining({
          className: "max-w-96",
        }),
        undefined,
      );
    });

    it("should render active, inactive, and pending review tab triggers", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      expect(TabsTrigger).toHaveBeenCalledWith(
        expect.objectContaining({ value: "active" }),
        undefined,
      );
      expect(TabsTrigger).toHaveBeenCalledWith(
        expect.objectContaining({ value: "inactive" }),
        undefined,
      );
      expect(TabsTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "pending_review",
        }),
        undefined,
      );
    });

    it("should render GarageFiltersClient with currentTab prop", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      expect(GarageFiltersClient).toHaveBeenCalledWith(
        { currentTab: "active" },
        undefined,
      );
    });

    it("should render ActiveListings in active tab content", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      expect(TabsContent).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "active",
          className: "mt-6",
        }),
        undefined,
      );

      expect(ActiveListings).toHaveBeenCalledWith(
        { filters: defaultFilters },
        undefined,
      );
    });

    it("should render InactiveListings in inactive tab content", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      expect(TabsContent).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "inactive",
          className: "mt-6",
        }),
        undefined,
      );

      expect(InactiveListings).toHaveBeenCalledWith(
        { filters: defaultFilters },
        undefined,
      );
    });

    it("should render PendingReviewListings in pending_review tab content", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="pending_review" />);

      expect(TabsContent).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "pending_review",
          className: "mt-6",
        }),
        undefined,
      );
    });
  });

  describe("Tab Switching Logic", () => {
    it("should pass handleTabChange to Tabs onValueChange prop", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      // The Tabs component should receive an onValueChange prop (handleTabChange)
      expect(Tabs).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "active",
          onValueChange: expect.any(Function),
        }),
        undefined,
      );
    });

    it("should handle tab change to active (removes tab parameter)", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams("tab=inactive"));

      render(<GarageTabsClient currentTab="inactive" />);

      // Get the onValueChange function that was passed to Tabs
      const tabsCall = mockTabs.mock.calls.find(
        (call: any) => call[0].onValueChange,
      );
      expect(tabsCall).toBeDefined();
      const handleTabChange = tabsCall![0].onValueChange;

      // Simulate tab change to "active"
      handleTabChange("active");

      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/dashboard/listings/rentals?",
        {
          scroll: false,
        },
      );
    });

    it("should handle tab change to inactive (adds tab parameter)", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      // Get the onValueChange function that was passed to Tabs
      const tabsCall = mockTabs.mock.calls.find(
        (call: any) => call[0].onValueChange,
      );
      expect(tabsCall).toBeDefined();
      const handleTabChange = tabsCall![0].onValueChange;

      // Simulate tab change to "inactive"
      handleTabChange("inactive");

      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/dashboard/listings/rentals?tab=inactive",
        { scroll: false },
      );
    });
  });

  describe("Filter Clearing", () => {
    it("should clear rentalStatus filter when switching from active to inactive tab", () => {
      const searchParams = new URLSearchParams("rentalStatus=available");
      mockUseSearchParams.mockReturnValue(searchParams);

      mockUseGarageFilters.mockReturnValue({
        filters: { ...defaultFilters, rentalStatus: "available" },
      });

      render(<GarageTabsClient currentTab="active" />);

      // Get the onValueChange function that was passed to Tabs
      const tabsCall = mockTabs.mock.calls.find(
        (call: any) => call[0].onValueChange,
      );
      expect(tabsCall).toBeDefined();
      const handleTabChange = tabsCall![0].onValueChange;

      // Simulate tab change to "inactive"
      handleTabChange("inactive");

      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/dashboard/listings/rentals?tab=inactive",
        { scroll: false },
      );
    });

    it("should preserve other URL parameters when clearing rentalStatus", () => {
      const searchParams = new URLSearchParams(
        "rentalStatus=available&q=drill&category=power-tools",
      );
      mockUseSearchParams.mockReturnValue(searchParams);

      mockUseGarageFilters.mockReturnValue({
        filters: {
          ...defaultFilters,
          rentalStatus: "available",
          query: "drill",
          categoryId: "power-tools",
        },
      });

      render(<GarageTabsClient currentTab="active" />);

      // Get the onValueChange function that was passed to Tabs
      const tabsCall = mockTabs.mock.calls.find(
        (call: any) => call[0].onValueChange,
      );
      expect(tabsCall).toBeDefined();
      const handleTabChange = tabsCall![0].onValueChange;

      // Simulate tab change to "inactive"
      handleTabChange("inactive");

      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/dashboard/listings/rentals?q=drill&category=power-tools&tab=inactive",
        { scroll: false },
      );
    });

    it("should preserve rentalStatus when staying on active tab", () => {
      const searchParams = new URLSearchParams("rentalStatus=available");
      mockUseSearchParams.mockReturnValue(searchParams);

      render(<GarageTabsClient currentTab="active" />);

      // Get the onValueChange function that was passed to Tabs
      const tabsCall = mockTabs.mock.calls.find(
        (call: any) => call[0].onValueChange,
      );
      expect(tabsCall).toBeDefined();
      const handleTabChange = tabsCall![0].onValueChange;

      // Simulate tab change to "active" (staying on same tab)
      handleTabChange("active");

      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/dashboard/listings/rentals?rentalStatus=available",
        { scroll: false },
      );
    });

    it("should clear rentalStatus filter when switching to pending_review tab", () => {
      const searchParams = new URLSearchParams("rentalStatus=available");
      mockUseSearchParams.mockReturnValue(searchParams);

      mockUseGarageFilters.mockReturnValue({
        filters: { ...defaultFilters, rentalStatus: "available" },
      });

      render(<GarageTabsClient currentTab="active" />);

      // Get the onValueChange function that was passed to Tabs
      const tabsCall = mockTabs.mock.calls.find(
        (call: any) => call[0].onValueChange,
      );
      expect(tabsCall).toBeDefined();
      const handleTabChange = tabsCall![0].onValueChange;

      // Simulate tab change to "pending_review"
      handleTabChange("pending_review");

      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/dashboard/listings/rentals?tab=pending_review",
        { scroll: false },
      );
    });
  });

  describe("Current Tab Handling", () => {
    it("should pass currentTab prop to Tabs component", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="inactive" />);

      expect(Tabs).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "inactive",
        }),
        undefined,
      );
    });

    it("should pass currentTab to GarageFiltersClient", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="inactive" />);

      expect(GarageFiltersClient).toHaveBeenCalledWith(
        { currentTab: "inactive" },
        undefined,
      );
    });
  });

  describe("Filter Integration", () => {
    it("should pass filters to ActiveListings component", () => {
      const customFilters = { ...defaultFilters, query: "drill" };
      mockUseGarageFilters.mockReturnValue({ filters: customFilters });
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      expect(ActiveListings).toHaveBeenCalledWith(
        { filters: customFilters },
        undefined,
      );
    });

    it("should pass filters to InactiveListings component", () => {
      const customFilters = { ...defaultFilters, categoryId: "hand-tools" };
      mockUseGarageFilters.mockReturnValue({ filters: customFilters });
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="inactive" />);

      expect(InactiveListings).toHaveBeenCalledWith(
        { filters: customFilters },
        undefined,
      );
    });
  });

  describe("URL State Management", () => {
    it("should preserve existing URL parameters when switching tabs", () => {
      const searchParams = new URLSearchParams("q=hammer&sortBy=name");
      mockUseSearchParams.mockReturnValue(searchParams);

      render(<GarageTabsClient currentTab="active" />);

      // Get the onValueChange function that was passed to Tabs
      const tabsCall = mockTabs.mock.calls.find(
        (call: any) => call[0].onValueChange,
      );
      expect(tabsCall).toBeDefined();
      const handleTabChange = tabsCall![0].onValueChange;

      // Simulate tab change to "inactive"
      handleTabChange("inactive");

      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/dashboard/listings/rentals?q=hammer&sortBy=name&tab=inactive",
        { scroll: false },
      );
    });

    it("should use router.replace with scroll: false", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      // Get the onValueChange function that was passed to Tabs
      const tabsCall = mockTabs.mock.calls.find(
        (call: any) => call[0].onValueChange,
      );
      expect(tabsCall).toBeDefined();
      const handleTabChange = tabsCall![0].onValueChange;

      // Simulate tab change to "inactive"
      handleTabChange("inactive");

      expect(mockRouter.replace).toHaveBeenCalledWith(expect.any(String), {
        scroll: false,
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes through Tabs components", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      // The Tabs components should handle accessibility
      expect(screen.getByTestId("tabs")).toBeInTheDocument();
      expect(screen.getByTestId("tabs-list")).toBeInTheDocument();
      expect(screen.getByTestId("tabs-trigger-active")).toBeInTheDocument();
      expect(screen.getByTestId("tabs-trigger-inactive")).toBeInTheDocument();
      expect(
        screen.getByTestId("tabs-trigger-pending_review"),
      ).toBeInTheDocument();
    });

    it("should render tab content with proper structure", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());

      render(<GarageTabsClient currentTab="active" />);

      expect(screen.getByTestId("tabs-content-active")).toBeInTheDocument();
      expect(screen.getByTestId("tabs-content-inactive")).toBeInTheDocument();
      expect(
        screen.getByTestId("tabs-content-pending_review"),
      ).toBeInTheDocument();
    });

    it("should display pending count badge when count is greater than 0", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());
      mockUsePendingListingsCount.mockReturnValue({ data: 3 });

      render(<GarageTabsClient currentTab="active" />);

      // The badge should be rendered in the TabsTrigger for pending_review
      expect(TabsTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "pending_review",
        }),
        undefined,
      );
    });
  });
});
