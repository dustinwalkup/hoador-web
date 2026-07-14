import type { FunctionComponent, SVGProps } from "react";
import {
  LayoutGridIcon,
  // HeartIcon,
  UserIcon,
  MailIcon,
  HomeIcon,
  BookOpenIcon,
  CreditCardIcon,
  FileSignatureIcon,
  HelpCircleIcon,
  SearchIcon,
  SettingsIcon,
  CalendarCheck,
  DollarSign,
  HandHelping,
} from "lucide-react";
import DoorIcon from "@/components/ui/door-icon";

export type IconComponent = FunctionComponent<SVGProps<SVGSVGElement>>;

export interface SubNavItem {
  readonly title: string;
  readonly url: string;
}

export interface MainNavItem {
  readonly title: string;
  readonly url?: string; // Optional for parent items with children
  readonly icon: IconComponent;
  readonly defaultOpen?: boolean;
  readonly items?: {
    readonly label?: string;
    readonly items: readonly SubNavItem[];
  }[]; // Support grouped sub-items
}

export const MAIN_NAV: MainNavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: HomeIcon },
  // TODO: Add Favorites
  // { title: "Favorites", url: "/dashboard/favorites", icon: HeartIcon },
  {
    title: "Neighborhood Needs",
    url: "/dashboard/needs",
    icon: HandHelping,
  },
  {
    title: "Browse",
    icon: DoorIcon,
    defaultOpen: true,
    items: [
      {
        items: [
          { title: "Rentals", url: "/dashboard/explore" },
          { title: "Services", url: "/dashboard/services" },
        ],
      },
    ],
  },
  {
    title: "Bookings",
    icon: CalendarCheck,
    items: [
      {
        label: "Rentals",
        items: [
          {
            title: "As owner",
            url: "/dashboard/rentals/incoming/requests",
          },
          {
            title: "As renter",
            url: "/dashboard/rentals/outgoing/requests",
          },
        ],
      },
      {
        label: "Services",
        items: [
          {
            title: "As provider",
            url: "/dashboard/services/incoming/pending",
          },
          {
            title: "As client",
            url: "/dashboard/services/outgoing/pending",
          },
        ],
      },
    ],
  },
  {
    title: "Your listings",
    icon: LayoutGridIcon,
    items: [
      {
        items: [
          { title: "My rentals", url: "/dashboard/listings/rentals" },
          { title: "My services", url: "/dashboard/listings/services" },
        ],
      },
    ],
  },
  { title: "Messages", url: "/dashboard/mailbox", icon: MailIcon },
  { title: "Payments", url: "/dashboard/payments", icon: DollarSign },
  { title: "Profile", url: "/dashboard/profile", icon: UserIcon },
];

export interface SecondaryNavItem {
  readonly title: string;
  readonly url: string;
  readonly icon: IconComponent;
}

export const NAV_SECONDARY: readonly SecondaryNavItem[] = [
  { title: "Settings", url: "#", icon: SettingsIcon },
  { title: "Get Help", url: "#", icon: HelpCircleIcon },
  { title: "Search", url: "#", icon: SearchIcon },
];

export interface DocumentLink {
  readonly name: string;
  readonly url: string;
  readonly icon: IconComponent;
}

export const DOCUMENT_LINKS: readonly DocumentLink[] = [
  { name: "Rental Agreements", url: "/agreements", icon: FileSignatureIcon },
  { name: "Invoices & Receipts", url: "/invoices", icon: CreditCardIcon },
  { name: "Safety Manuals", url: "/safety-manuals", icon: BookOpenIcon },
  { name: "FAQs", url: "/faq", icon: HelpCircleIcon },
];

export interface UserData {
  readonly name: string;
  readonly firstName: string;
  readonly email: string;
  readonly avatar: string;
  readonly initials: string;
}

export interface DashboardConstants {
  readonly mainNav: readonly MainNavItem[];
  readonly navSecondary: readonly SecondaryNavItem[];
  readonly documents: readonly DocumentLink[];
}

export const DASHBOARD: DashboardConstants = {
  mainNav: MAIN_NAV,
  navSecondary: NAV_SECONDARY,
  documents: DOCUMENT_LINKS,
};
