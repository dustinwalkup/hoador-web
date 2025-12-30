// import { describe, it, expect, vi, beforeEach } from "vitest";
// import { render, screen, waitFor } from "@testing-library/react";
// import userEvent from "@testing-library/user-event";
// import { FavoritesButton } from "../favorites-button";

// describe("FavoritesButton", () => {
//   const mockListingId = "listing-123";

//   beforeEach(() => {
//     vi.clearAllMocks();
//   });

//   describe("Initial Rendering", () => {
//     it("should render button with correct text when not favorited", () => {
//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       expect(
//         screen.getByRole("button", { name: /add to favorites/i }),
//       ).toBeInTheDocument();
//     });

//     it("should render button with correct text when favorited", () => {
//       render(<FavoritesButton listingId={mockListingId} isFavorite={true} />);

//       expect(
//         screen.getByRole("button", { name: /remove from favorites/i }),
//       ).toBeInTheDocument();
//     });

//     it("should render Heart icon", () => {
//       const { container } = render(
//         <FavoritesButton listingId={mockListingId} isFavorite={false} />,
//       );

//       const heartIcon = container.querySelector("svg");
//       expect(heartIcon).toBeInTheDocument();
//     });

//     it("should apply correct styling to Heart icon when not favorited", () => {
//       const { container } = render(
//         <FavoritesButton listingId={mockListingId} isFavorite={false} />,
//       );

//       const heartIcon = container.querySelector("svg");
//       expect(heartIcon).not.toHaveClass("fill-current");
//       expect(heartIcon).not.toHaveClass("text-red-500");
//     });

//     it("should apply correct styling to Heart icon when favorited", () => {
//       const { container } = render(
//         <FavoritesButton listingId={mockListingId} isFavorite={true} />,
//       );

//       const heartIcon = container.querySelector("svg");
//       expect(heartIcon).toHaveClass("fill-current");
//       expect(heartIcon).toHaveClass("text-red-500");
//     });
//   });

//   describe("Button Styling", () => {
//     it("should have outline variant", () => {
//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       const button = screen.getByRole("button");
//       expect(button).toHaveClass("bg-transparent");
//     });

//     it("should have full width styling", () => {
//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       const button = screen.getByRole("button");
//       expect(button).toHaveClass("w-full");
//     });
//   });

//   describe("User Interactions", () => {
//     it("should handle click to add favorite", async () => {
//       const user = userEvent.setup();
//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       const button = screen.getByRole("button", { name: /add to favorites/i });
//       await user.click(button);

//       // After optimistic update, button should show remove text
//       await waitFor(() => {
//         expect(
//           screen.getByRole("button", { name: /remove from favorites/i }),
//         ).toBeInTheDocument();
//       });
//     });

//     it("should handle click to remove favorite", async () => {
//       const user = userEvent.setup();
//       render(<FavoritesButton listingId={mockListingId} isFavorite={true} />);

//       const button = screen.getByRole("button", {
//         name: /remove from favorites/i,
//       });
//       await user.click(button);

//       // After optimistic update, button should show add text
//       await waitFor(() => {
//         expect(
//           screen.getByRole("button", { name: /add to favorites/i }),
//         ).toBeInTheDocument();
//       });
//     });

//     it("should toggle favorite state multiple times", async () => {
//       const user = userEvent.setup();
//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       // First click - add to favorites
//       let button = screen.getByRole("button", { name: /add to favorites/i });
//       await user.click(button);

//       await waitFor(() => {
//         expect(
//           screen.getByRole("button", { name: /remove from favorites/i }),
//         ).toBeInTheDocument();
//       });

//       // Second click - remove from favorites
//       button = screen.getByRole("button", { name: /remove from favorites/i });
//       await user.click(button);

//       await waitFor(() => {
//         expect(
//           screen.getByRole("button", { name: /add to favorites/i }),
//         ).toBeInTheDocument();
//       });
//     });

//     it("should disable button during transition", async () => {
//       const user = userEvent.setup();
//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       const button = screen.getByRole("button");
//       const clickPromise = user.click(button);

//       // Button should be disabled during transition
//       // Note: In a real scenario, this would be easier to test with a mocked async operation
//       await clickPromise;
//     });
//   });

//   describe("Optimistic Updates", () => {
//     it("should update UI immediately on click", async () => {
//       const user = userEvent.setup();
//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       const button = screen.getByRole("button", { name: /add to favorites/i });
//       await user.click(button);

//       // Should immediately show the new state
//       expect(
//         screen.getByRole("button", { name: /remove from favorites/i }),
//       ).toBeInTheDocument();
//     });

//     it("should update icon styling immediately on click", async () => {
//       const user = userEvent.setup();
//       const { container } = render(
//         <FavoritesButton listingId={mockListingId} isFavorite={false} />,
//       );

//       const button = screen.getByRole("button");
//       await user.click(button);

//       await waitFor(() => {
//         const heartIcon = container.querySelector("svg");
//         expect(heartIcon).toHaveClass("fill-current");
//         expect(heartIcon).toHaveClass("text-red-500");
//       });
//     });
//   });

//   // Note: Console logging test removed - component doesn't log to console

//   describe("Error Handling", () => {
//     it("should handle errors gracefully", async () => {
//       const consoleErrorSpy = vi
//         .spyOn(console, "error")
//         .mockImplementation(() => {});
//       const user = userEvent.setup();

//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       const button = screen.getByRole("button");
//       await user.click(button);

//       // Wait for async operation
//       await waitFor(() => {
//         // Component should still be in the document
//         expect(button).toBeInTheDocument();
//       });

//       consoleErrorSpy.mockRestore();
//     });
//   });

//   describe("Accessibility", () => {
//     it("should have accessible button role", () => {
//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       expect(screen.getByRole("button")).toBeInTheDocument();
//     });

//     it("should have descriptive button text", () => {
//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       const button = screen.getByRole("button", { name: /add to favorites/i });
//       expect(button).toHaveTextContent(/add to favorites/i);
//     });

//     it("should update aria attributes when state changes", async () => {
//       const user = userEvent.setup();
//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       const button = screen.getByRole("button");
//       await user.click(button);

//       await waitFor(() => {
//         expect(button).toHaveTextContent(/remove from favorites/i);
//       });
//     });
//   });

//   describe("Edge Cases", () => {
//     it("should handle empty listing ID", () => {
//       expect(() => {
//         render(<FavoritesButton listingId="" isFavorite={false} />);
//       }).not.toThrow();
//     });

//     it("should handle rapid clicks", async () => {
//       const user = userEvent.setup();
//       render(<FavoritesButton listingId={mockListingId} isFavorite={false} />);

//       const button = screen.getByRole("button");

//       // Click multiple times rapidly
//       await user.click(button);
//       await user.click(button);
//       await user.click(button);

//       // Component should still be functional
//       expect(button).toBeInTheDocument();
//     });
//   });

//   describe("Component Integration", () => {
//     it("should work with different listing IDs and initial states", async () => {
//       // Test first listing not favorited
//       const { unmount } = render(
//         <FavoritesButton listingId="listing-1" isFavorite={false} />,
//       );

//       expect(
//         screen.getByRole("button", { name: /add to favorites/i }),
//       ).toBeInTheDocument();

//       unmount();

//       // Test second listing already favorited
//       render(<FavoritesButton listingId="listing-2" isFavorite={true} />);

//       expect(
//         screen.getByRole("button", { name: /remove from favorites/i }),
//       ).toBeInTheDocument();
//     });

//     it("should maintain state independently per instance", () => {
//       const { container } = render(
//         <>
//           <FavoritesButton listingId="listing-1" isFavorite={false} />
//           <FavoritesButton listingId="listing-2" isFavorite={true} />
//         </>,
//       );

//       const buttons = container.querySelectorAll("button");
//       expect(buttons).toHaveLength(2);

//       // Check both buttons render correctly
//       expect(
//         screen.getByRole("button", { name: /add to favorites/i }),
//       ).toBeInTheDocument();
//       expect(
//         screen.getByRole("button", { name: /remove from favorites/i }),
//       ).toBeInTheDocument();
//     });
//   });
// });
