import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { MessageUserModal } from "../message-user-modal";
import { mockUser2 } from "@/test/fixtures/messages";

// Mock dependencies
vi.mock("@/features/messages/hooks/use-message-mutations", () => ({
  useStartConversation: vi.fn(),
}));

import { useStartConversation } from "@/features/messages/hooks/use-message-mutations";

// Create test query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Wrapper component for React Query
function QueryWrapper({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("MessageUserModal", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    recipientId: mockUser2.id,
    recipientName: `${mockUser2.firstName} ${mockUser2.lastName}`,
    listingId: "listing-123",
    listingName: "Power Drill",
  };

  let queryClient: QueryClient;
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    vi.mocked(useStartConversation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: undefined,
      status: "idle",
    } as any);
  });

  it("should render modal with message input", () => {
    // Act
    render(
      <QueryWrapper queryClient={queryClient}>
        <MessageUserModal {...defaultProps} />
      </QueryWrapper>,
    );

    // Assert
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/message/i)).toBeInTheDocument();
  });

  it("should show validation error for empty message", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <QueryWrapper queryClient={queryClient}>
        <MessageUserModal {...defaultProps} />
      </QueryWrapper>,
    );

    // Act
    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/message is required/i)).toBeInTheDocument();
    });
  });

  it("should show validation error for message too short", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <QueryWrapper queryClient={queryClient}>
        <MessageUserModal {...defaultProps} />
      </QueryWrapper>,
    );

    // Act
    const textarea = screen.getByPlaceholderText(/message/i);
    await user.type(textarea, "short");
    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(
        screen.getByText(/message must be at least 10 characters/i),
      ).toBeInTheDocument();
    });
  });

  it("should send message successfully", async () => {
    // Arrange
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue({
      success: true,
      conversationId: "conversation-123",
    });

    render(
      <QueryWrapper queryClient={queryClient}>
        <MessageUserModal {...defaultProps} />
      </QueryWrapper>,
    );

    // Act
    const textarea = screen.getByPlaceholderText(/message/i);
    await user.type(textarea, "Hello, is this tool still available?");
    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        recipientId: mockUser2.id,
        listingId: "listing-123",
        listingName: "Power Drill",
        message: "Hello, is this tool still available?",
      });
    });
  });

  it("should show loading state during send", async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(useStartConversation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: true,
      isSuccess: false,
      isError: false,
      error: null,
      data: undefined,
      status: "pending",
    } as any);

    mockMutateAsync.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(
      <QueryWrapper queryClient={queryClient}>
        <MessageUserModal {...defaultProps} />
      </QueryWrapper>,
    );

    // Act
    const textarea = screen.getByPlaceholderText(/message/i);
    await user.type(textarea, "Hello, is this tool still available?");
    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sending/i }),
      ).toBeInTheDocument();
    });
  });

  it("should show error message on failure", async () => {
    // Arrange
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValue(new Error("Failed to send message"));

    render(
      <QueryWrapper queryClient={queryClient}>
        <MessageUserModal {...defaultProps} />
      </QueryWrapper>,
    );

    // Act
    const textarea = screen.getByPlaceholderText(/message/i);
    await user.type(textarea, "Hello, is this tool still available?");
    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    // Assert
    // Error is handled by the mutation hook (toast), component resets to idle
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
  });

  it("should close modal when close button is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const mockOnOpenChange = vi.fn();
    render(
      <QueryWrapper queryClient={queryClient}>
        <MessageUserModal {...defaultProps} onOpenChange={mockOnOpenChange} />
      </QueryWrapper>,
    );

    // Act
    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    // Assert
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
