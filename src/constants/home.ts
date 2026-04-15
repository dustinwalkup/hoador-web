export interface HeaderConstants {
  readonly signUp: string;
  readonly logIn: string;
}

export interface HeroConstants {
  readonly titleA: string;
  readonly titleB: string;
  readonly description: string;
  readonly inputPlaceholder: string;
  readonly chips: readonly string[];
  readonly secondaryCtaLabel: string;
  readonly secondaryCtaHref: string;
}

export interface UseCaseCategory {
  readonly title: string;
  readonly description: string;
  readonly imageUrl: string;
  readonly iconName: string;
}

export interface CarouselSectionCopy {
  readonly title: string;
  readonly description?: string;
}

/** Mock data for homepage rental carousel (matches ListingCard props). */
export interface HomepageListingMock {
  readonly id: string;
  readonly name: string;
  readonly price: string;
  readonly distance?: number;
  readonly rating: number;
  readonly reviews: number;
  readonly imageUrl: string;
  readonly isNew?: boolean;
  readonly status: string;
  readonly deliveryMode?: "pickup_only" | "delivery_only" | "both_available";
  readonly setupAvailable?: boolean;
}

/** Mock data for homepage service carousel. */
export interface HomepageServiceMock {
  readonly id: string;
  readonly providerDisplayName: string;
  readonly avatarInitials: string;
  readonly avatarImageUrl?: string;
  readonly title: string;
  readonly description: string;
  readonly price: number;
  readonly pricingType: "hourly" | "flat";
  readonly rating: number;
  readonly reviewCount: number;
  readonly categoryLabel: string;
}

export interface CommunityConstants {
  readonly title: string;
  readonly description: string;
  readonly benefits: readonly string[];
  readonly buttonLabel: string;
}

export interface TrustSafetyConstants {
  readonly title: string;
  readonly points: readonly string[];
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

export interface RequestHoadorConstants {
  readonly title: string;
  readonly description: string;
  readonly buttonLabel: string;
}

/** Embla options for marketing carousels: loop and quicker programmatic scrolls (arrows). */
export const HOMEPAGE_CAROUSEL_EMBA_OPTS = {
  align: "start" as const,
  loop: true,
  duration: 15,
};

/**
 * Continuous auto-scroll (pixels per frame, ~60fps). Higher = faster drift.
 * Rentals scroll forward; services use backward options below.
 */
export const HOMEPAGE_CAROUSEL_AUTO_SCROLL = {
  direction: "forward" as const,
  speed: 1.15,
  startDelay: 0,
  playOnInit: true,
  stopOnFocusIn: true,
  stopOnInteraction: false,
  stopOnMouseEnter: true,
};

export const HOMEPAGE_SERVICE_CAROUSEL_AUTO_SCROLL = {
  direction: "backward" as const,
  speed: 1.15,
  startDelay: 400,
  playOnInit: true,
  stopOnFocusIn: true,
  stopOnInteraction: false,
  stopOnMouseEnter: true,
};

export interface HomePageConstants {
  readonly header: HeaderConstants;
  readonly hero: HeroConstants;
  readonly useCaseCategories: readonly UseCaseCategory[];
  readonly listingCarousel: CarouselSectionCopy;
  readonly homepageListings: readonly HomepageListingMock[];
  readonly serviceCarousel: CarouselSectionCopy;
  readonly homepageServices: readonly HomepageServiceMock[];
  readonly requestHoador: RequestHoadorConstants;
  readonly community: CommunityConstants;
  readonly trustSafety: TrustSafetyConstants;
  readonly howItWorks: HowItWorksConstants;
  readonly cta: CtaConstants;
}

export const HOME_PAGE: HomePageConstants = {
  header: {
    signUp: "Sign up",
    logIn: "Log in",
  },
  hero: {
    titleA: "Your neighborhood marketplace for",
    titleB: "rentals & services",
    description:
      "Borrow tools, find local help, or earn money from what you already own, all within your community.",
    inputPlaceholder: "What are you looking for?",
    chips: [
      "Rent a pressure washer",
      "Find a babysitter",
      "Borrow camping gear",
      "Hire help for yard work",
    ],
    secondaryCtaLabel: "See how it works",
    secondaryCtaHref: "#how-it-works",
  },
  useCaseCategories: [
    {
      title: "Tools & Equipment",
      description: "Power tools, ladders, and project gear from people nearby.",
      imageUrl: "/images/mock/tools/ladder.jpg",
      iconName: "Wrench",
    },
    {
      title: "Local Services",
      description: "Yard work, small repairs, and neighbor offered help.",
      imageUrl: "/images/stock/riding-lawn-mower.jpg",
      iconName: "HandHelping",
    },
    {
      title: "Kids & Baby Gear",
      description: "Strollers, high chairs, and gear they outgrow fast.",
      imageUrl: "/images/stock/bounce-house.webp",
      iconName: "Baby",
    },
    {
      title: "Moving & Trailers",
      description: "Trailers, dollies, and hauling when you need it.",
      imageUrl: "/images/stock/guy-moving1.jpg",
      iconName: "Truck",
    },
    {
      title: "Event & Party Supplies",
      description: "Tables, tents, and extras for gatherings big or small.",
      imageUrl: "/images/stock/tables.jpg",
      iconName: "PartyPopper",
    },
    {
      title: "Lawn & Garden",
      description: "Mowers, trimmers, pressure washers, and yard care help.",
      imageUrl: "/images/stock/yard-work.jpg",
      iconName: "Leaf",
    },
  ],
  listingCarousel: {
    title: "See what neighbors list",
    description:
      "Examples of real listings you might find once Hoador is live in your area.",
  },
  homepageListings: [
    {
      id: "home-mock-listing-001",
      name: "DeWalt 7-1/4 in. circular saw",
      price: "$18 / day",
      distance: 0.4,
      rating: 4.9,
      reviews: 28,
      imageUrl: "/images/stock/dewalt.webp",
      isNew: false,
      status: "available",
      deliveryMode: "pickup_only",
    },
    {
      id: "home-mock-listing-002",
      name: "Medical Knee Scooter",
      price: "$15 / day",
      distance: 0.6,
      rating: 4.8,
      reviews: 41,
      imageUrl: "/images/stock/scooter.jpg",
      status: "available",
      deliveryMode: "both_available",
    },
    {
      id: "home-mock-listing-007",
      name: "7ft Single Person Kayak",
      price: "$12 / day",
      distance: 0.2,
      rating: 4.5,
      reviews: 23,
      imageUrl: "/images/stock/kayak.webp",
      status: "available",
      deliveryMode: "both_available",
    },
    {
      id: "home-mock-listing-003",
      name: "Travel Stroller (foldable)",
      price: "$12 / day",
      distance: 0.3,
      rating: 5.0,
      reviews: 9,
      imageUrl: "/images/stock/stroller.webp",
      isNew: true,
      status: "available",
      deliveryMode: "pickup_only",
    },
    {
      id: "home-mock-listing-004",
      name: "Mytee Carpet Cleaner",
      price: "$35 / day",
      distance: 0.8,
      rating: 4.7,
      reviews: 16,
      imageUrl: "/images/stock/carpet-cleaner.webp",
      status: "available",
      deliveryMode: "pickup_only",
    },
    {
      id: "home-mock-listing-005",
      name: "10x8 utility trailer",
      price: "$25 / day",
      distance: 1.1,
      rating: 4.9,
      reviews: 52,
      imageUrl: "/images/stock/trailer.webp",
      status: "available",
      deliveryMode: "pickup_only",
    },
    {
      id: "home-mock-listing-006",
      name: "4 person dome tent",
      price: "$20 / weekend",
      distance: 0.5,
      rating: 4.1,
      reviews: 32,
      imageUrl: "/images/stock/tent.jpg",
      status: "available",
      deliveryMode: "pickup_only",
    },
    {
      id: "home-mock-listing-008",
      name: "iLive Karaoke Machine",
      price: "$10 / day",
      distance: 0.3,
      rating: 4.8,
      reviews: 17,
      imageUrl: "/images/stock/karaoke.webp",
      status: "available",
      deliveryMode: "both_available",
    },
  ],
  serviceCarousel: {
    title: "Local services from neighbors",
    description: "",
  },
  homepageServices: [
    {
      id: "home-mock-service-001",
      providerDisplayName: "Jordan M.",
      avatarInitials: "JM",
      avatarImageUrl: "/images/mock/users/dustin.png",
      title: "Weekly lawn mowing",
      description:
        "Mow, edge, and bag clippings for typical suburban lots. Tools included.",
      price: 55,
      pricingType: "flat",
      rating: 4.9,
      reviewCount: 36,
      categoryLabel: "Yard work",
    },
    {
      id: "home-mock-service-002",
      providerDisplayName: "Sam R.",
      avatarInitials: "SR",
      avatarImageUrl: "/images/mock/users/avatar2.jpg",
      title: "Furniture assembly & moves",
      description:
        "Help with IKEA builds, TV mounts, and moving heavy items in your home.",
      price: 40,
      pricingType: "hourly",
      rating: 4.8,
      reviewCount: 22,
      categoryLabel: "Handyman",
    },
    {
      id: "home-mock-service-003",
      providerDisplayName: "Alex P.",
      avatarInitials: "AP",
      avatarImageUrl: "/images/mock/users/avatar1.jpg",
      title: "Evening babysitting",
      description:
        "Experienced sitter for weeknights. Comfortable with toddlers and pets.",
      price: 22,
      pricingType: "hourly",
      rating: 5.0,
      reviewCount: 14,
      categoryLabel: "Childcare",
    },
    {
      id: "home-mock-service-004",
      providerDisplayName: "Chris L.",
      avatarInitials: "CL",
      avatarImageUrl: "/images/mock/users/alex.webp",
      title: "Pressure washing (driveways)",
      description:
        "Refresh concrete and siding. You provide water hookup; I bring the washer.",
      price: 95,
      pricingType: "flat",
      rating: 4.7,
      reviewCount: 19,
      categoryLabel: "Exterior",
    },
    {
      id: "home-mock-service-005",
      providerDisplayName: "Taylor K.",
      avatarInitials: "TK",
      avatarImageUrl: "/images/mock/users/avatar3.jpg",
      title: "Dog walking (30 min)",
      description: "Midday walks in your neighborhood. Rain or shine.",
      price: 18,
      pricingType: "flat",
      rating: 4.9,
      reviewCount: 41,
      categoryLabel: "Pets",
    },
  ],
  requestHoador: {
    title: "Bring Hoador to your neighborhood",
    description:
      "We are rolling out community by community. Request access for your HOA and help bring tool sharing, local services, and extra income opportunities to your neighborhood. Join the waitlist when you submit.",
    buttonLabel: "Request Hoador for Your Community",
  },
  community: {
    title: "Make your neighborhood more useful",
    description:
      "Hoador is built for approved communities so sharing stays close to home.",
    benefits: [
      "Borrow instead of buying",
      "Earn from things sitting unused",
      "Get help from people nearby",
      "Build real connections with neighbors",
    ],
    buttonLabel: "Request Hoador for Your Community",
  },
  trustSafety: {
    title: "Safe, simple, and built for neighbors",
    points: [
      "Secure payments through the platform",
      "24-hour dispute protection after rentals",
      "Profiles and reviews build accountability",
      "Only accessible within your community",
    ],
  },
  howItWorks: {
    title: "How it works",
    description: "Three steps to earn or save with neighbors",
    items: [
      {
        id: 1,
        title: "List your item or service",
        description:
          "Take a few photos, set your price, and make it available to neighbors",
      },
      {
        id: 2,
        title: "Connect with neighbors",
        description:
          "Approve requests and coordinate pickup or service times that work for you",
      },
      {
        id: 3,
        title: "Earn or save money",
        description: "Make extra income or avoid buying things you rarely use",
      },
    ],
    buttonLabel: "Learn more about our process",
  },
  cta: {
    title: "Ready to unlock your neighborhood marketplace?",
    description:
      "Tell us about your HOA or community and we will reach out about access.",
    buttonLabel: "Request Hoador for Your Community",
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
        "Your neighborhood marketplace for rentals and local services. Borrow tools, book help, and share with neighbors in approved communities.",
      publisher: {
        "@id": "https://www.hoador.com/#organization",
      },
    },
  ],
};
