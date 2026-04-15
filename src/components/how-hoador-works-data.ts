import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CheckCircle,
  DollarSign,
  Search,
  Tag,
  Users,
} from "lucide-react";

export interface HowHoadorWorksStep {
  title: string;
  description: string;
  Icon: LucideIcon;
}

/** Three steps for renters & clients (Find → Request → Meet & use). */
export const renterClientSteps: HowHoadorWorksStep[] = [
  {
    title: "Find something near you",
    description:
      "Browse items and services listed by people in your community.",
    Icon: Search,
  },
  {
    title: "Request a booking",
    description:
      "Pick your dates or schedule and send a request — no commitment until accepted.",
    Icon: Calendar,
  },
  {
    title: "Meet & use",
    description: "Meet up to receive the item or have the service completed.",
    Icon: Users,
  },
];

/** Three steps for owners & providers (List → Accept → Get paid). */
export const ownerProviderSteps: HowHoadorWorksStep[] = [
  {
    title: "List what you have",
    description:
      "List an item to rent or a service you offer — takes under 2 minutes.",
    Icon: Tag,
  },
  {
    title: "Accept a request",
    description: "Review requests and accept the ones that work for you.",
    Icon: CheckCircle,
  },
  {
    title: "Get paid",
    description:
      "Payment is released when the rental starts or service is completed. Funds arrive via Stripe in 1–2 business days.",
    Icon: DollarSign,
  },
];

export const howItWorksFaqItems: { question: string; answer: string }[] = [
  {
    question: "Is Hoador free to join?",
    answer:
      "Yes — creating an account, browsing listings, and messaging are completely free. You only pay when you book a rental or service. Listing items or services is free too.",
  },
  {
    question: "How does payment work?",
    answer:
      "Your card is charged only after the owner or provider accepts your request. The payment is held by the platform until the rental or service is complete and a 24-hour dispute window passes, then it's released to the owner or provider. Payouts arrive via Stripe in 1–2 business days.",
  },
  {
    question: "What if something goes wrong?",
    answer:
      "After a rental is returned or a service is completed, both parties have a 24-hour window to file a dispute. During that time no money moves. If a dispute is filed, the Hoador team reviews it and works with both sides to reach a fair resolution before any payout is released.",
  },
];
