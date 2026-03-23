import type { FunctionComponent, SVGProps } from "react";
import {
  TagIcon,
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
  ActivityIcon,
  DollarSign,
  Briefcase,
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
  readonly items?: {
    readonly label: string;
    readonly items: readonly SubNavItem[];
  }[]; // Support grouped sub-items
}

export const MAIN_NAV: MainNavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: HomeIcon },
  { title: "Explore", url: "/dashboard/explore", icon: DoorIcon },
  { title: "Services", url: "/dashboard/services", icon: Briefcase },
  // TODO: Add Favorites
  // { title: "Favorites", url: "/dashboard/favorites", icon: HeartIcon },
  {
    title: "Activity",
    icon: ActivityIcon,
    items: [
      {
        label: "RENTALS",
        items: [
          {
            title: "Incoming requests",
            url: "/dashboard/rentals/incoming/requests",
          },
          {
            title: "Outgoing requests",
            url: "/dashboard/rentals/outgoing/requests",
          },
        ],
      },
      {
        label: "SERVICES",
        items: [
          {
            title: "Incoming requests",
            url: "/dashboard/services/incoming",
          },
          {
            title: "Outgoing requests",
            url: "/dashboard/services/outgoing",
          },
        ],
      },
    ],
  },
  {
    title: "Listings",
    icon: TagIcon,
    items: [
      {
        label: "RENTALS",
        items: [{ title: "My rentals", url: "/dashboard/listings/rentals" }],
      },
      {
        label: "SERVICES",
        items: [{ title: "My services", url: "/dashboard/listings/services" }],
      },
    ],
  },
  { title: "Mailbox", url: "/dashboard/mailbox", icon: MailIcon },
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
