/**
 * Static copy for the User Dashboard at /dashboard.
 * Widget content is driven by server data; this file holds only header copy.
 */

export interface DashboardHeaderConstants {
  readonly titleFor: (userName: string) => string;
  readonly description: string;
}

export const DASHBOARD_HEADER: DashboardHeaderConstants = {
  titleFor: (name: string) => `Welcome back, ${name}!`,
  description: "Here's what's happening with your listings and rentals.",
};
