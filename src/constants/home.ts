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
  readonly iconName: string;
}

export interface CommunityConstants {
  readonly title: string;
  readonly description: string;
  readonly featuredCards: readonly FeatureCard[];
  readonly buttonLabel: string;
}

export interface FeatureCard {
  readonly iconName: string;
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
    description:
      "Borrow tools or offer simple services to neighbors—earn money, save time, and strengthen your community",
    inputPlaceholder: "What are you looking for?",
  },
  valueProp: {
    title: "Get the Tools You Need—Right in Your Neighborhood",
    description:
      "Stop overpaying for tools you’ll only use once. Hoador helps you borrow power tools, lawn equipment, and home-project essentials from real people around you. Lower cost for renters, extra income for owners, and less waste for everyone.",
    buttonLabel: "Explore all categories",
    categoryCards: [
      {
        title: "Power & Hand Tools",
        description:
          "Drills, saws, sanders, and more available in your neighborhood.",
        imageUrl: "/images/mock/tools/tool-bench.jpg",
        iconName: "PenToolIcon",
      },
      {
        title: "Trucks & Trailers",
        description: "Moving? Need to haul something? Your neighbors can help.",
        imageUrl: "/images/mock/tools/trailer-hitch.jpg",
        iconName: "Truck",
      },
      {
        title: "Lawn & Garden",
        description:
          "Mowers, trimmers, pressure washers, and more for your yard.",
        imageUrl: "/images/mock/tools/garden-tools.jpg",
        iconName: "Home",
      },
    ],
  },
  community: {
    title: "Built Around Local Communities",
    description:
      "Every rental strengthens your neighborhood. Hoador connects people who want to get projects done with those who already have the right equipment. More sharing. Less clutter. Better projects.",
    featuredCards: [
      {
        iconName: "Users",
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
        iconName: "Coins",
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

// Structured data for SEO
export const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.hoador.com/#organization",
      name: "Hoador",
      url: "https://www.hoador.com",
      logo: {
        "@type": "ImageObject",
        url: "https://www.hoador.com/hoador-logo.svg",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://www.hoador.com/#website",
      url: "https://www.hoador.com",
      name: "Hoador",
      description:
        "Your neighborhood tool rental marketplace. Borrow tools from neighbors, save money, and build community.",
      publisher: {
        "@id": "https://www.hoador.com/#organization",
      },
    },
  ],
};
