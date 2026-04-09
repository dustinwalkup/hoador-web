/**
 * Human-readable label for `dispute_role` values.
 * Rental listing owners are stored as `owner` (new) or legacy `provider`; service
 * providers use `provider`.
 */
export function formatDisputeParticipantRole(
  role: string,
  context: { rentalId?: string | null; serviceBookingId?: string | null },
): string {
  switch (role) {
    case "renter":
      return "Renter";
    case "owner":
      return "Owner";
    case "requester":
      return "Client";
    case "provider":
      return context.rentalId ? "Owner" : "Provider";
    default:
      return role;
  }
}
