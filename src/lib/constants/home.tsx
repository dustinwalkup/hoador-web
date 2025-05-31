import { ReactNode } from "react";
import { Coins, Home, Truck, PenToolIcon as Tool, Users } from "lucide-react";

export interface HeaderConstants {
  readonly signUp: string;
  readonly logIn: string;
}

export interface HeroConstants {
  readonly titleA: string;
  readonly titleB: string;
  readonly description: string;
  readonly inputPlaceholder: string;
}

export interface ValuePropConstants {
  readonly title: string;
  readonly description: string;
  readonly buttonLabel: string;
  readonly categoryCards: readonly CategoryCard[];
}

export interface CategoryCard {
  readonly title: string;
  readonly description: string;
  readonly imageUrl: string;
  readonly icon: ReactNode;
}

export interface CommunityConstants {
  readonly title: string;
  readonly description: string;
  readonly featuredCards: readonly FeatureCard[];
  readonly buttonLabel: string;
}

export interface FeatureCard {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly benefits: string[];
  readonly variant: "default" | "primary";
}

export interface HowItWorksConstants {
  readonly title: string;
  readonly description: string;
  readonly items: readonly HowItWorksItem[];
  readonly buttonLabel: string;
}

export interface HowItWorksItem {
  readonly id: number;
  readonly title: string;
  readonly description: string;
}

export interface CtaConstants {
  readonly title: string;
  readonly description: string;
  readonly buttonLabel: string;
}

export interface HomePageConstants {
  readonly header: HeaderConstants;
  readonly hero: HeroConstants;
  readonly valueProp: ValuePropConstants;
  readonly community: CommunityConstants;
  readonly howItWorks: HowItWorksConstants;
  readonly cta: CtaConstants;
}

export const HOME_PAGE: HomePageConstants = {
  header: {
    signUp: "Sign up",
    logIn: "Log in",
  },
  hero: {
    titleA: "Your neighborhood",
    titleB: "rental marketplace",
    description: "Borrow tools from neighbors, save money, and build community",
    inputPlaceholder: "What are you looking for?",
  },
  valueProp: {
    title: "Save Time, Make Money",
    description:
      "Tools from a hyper-local marketplace are cheaper than renting or buying from big box stores. Leverage what you already have to make money.",
    buttonLabel: "Explore all categories",
    categoryCards: [
      {
        title: "Power & Hand Tools",
        description:
          "Drills, saws, sanders, and more available in your neighborhood.",
        imageUrl: "/images/mock/tool-bench.jpg",
        icon: <Tool className="h-6 w-6" />,
      },
      {
        title: "Trucks & Trailers",
        description: "Moving? Need to haul something? Your neighbors can help.",
        imageUrl: "/images/mock/trailer-hitch.jpg",
        icon: <Truck className="h-6 w-6" />,
      },
      {
        title: "Lawn & Garden",
        description:
          "Mowers, trimmers, pressure washers, and more for your yard.",
        imageUrl: "/images/mock/garden-tools.jpg",
        icon: <Home className="h-6 w-6" />,
      },
    ],
  },
  community: {
    title: "Neighbor-to-neighborhood",
    description:
      "Trust in a community marketplace that is limited to households in your neighborhood. Build connections while sharing resources.",
    featuredCards: [
      {
        icon: <Users className="text-primary h-12 w-12" />,
        title: "Now that's a win-win",
        description:
          "The whole neighborhood wins. Improve property value and make money while helping neighbors.",
        benefits: [
          "Save money by borrowing instead of buying rarely used tools",
          "Earn passive income from tools sitting unused in your garage",
          "Build community connections with neighbors",
        ],
        variant: "default",
      },
      {
        icon: <Coins className="h-12 w-12" />,
        title: "Earn Hoador Points",
        description:
          "Use points to pay for rentals or get discounts on your next tool rental.",
        benefits: [
          "Redeem payouts for loans with Hoador points and get 25% more on your payout earnings!",
          "Earn Hoador points by getting outstanding reviews and reaching milestones",
          "Points never expire and can be used for any rental on the platform",
        ],
        variant: "primary",
      },
    ],
    buttonLabel: "Join Hoador",
  },
  howItWorks: {
    title: "How Hoador works",
    description: "Simple, secure, and designed to build community",
    items: [
      {
        id: 1,
        title: "List your tools",
        description:
          "Take a few photos, set your price, and share what's sitting unused in your garage",
      },
      {
        id: 2,
        title: "Connect with neighbors",
        description:
          "Approve rental requests and coordinate pickup times that work for you",
      },
      {
        id: 3,
        title: "Earn & save",
        description:
          "Make money from your tools or save by borrowing instead of buying",
      },
    ],
    buttonLabel: "Learn more about our process",
  },
  cta: {
    title: "Ready to join your neighborhood marketplace?",
    description: "Sign up today and start sharing tools with your neighbors",
    buttonLabel: "Get started",
  },
};
