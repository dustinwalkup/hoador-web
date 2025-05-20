import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Coins,
  Search,
  Home,
  Truck,
  PenToolIcon as Tool,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CategoryCard from "@/components/category-card";
import FeatureCard from "@/components/feature-card";
import FadeIn from "@/components/fade-in";
import AnimatedSection from "@/components/animated-section";

// Header
const SIGN_UP = "Sign up";
const LOG_IN = "Log in";

// Hero Section
const HERO_TITLE_A = "Your neighborhood";
const HERO_TITLE_B = "rental marketplace";
const HERO_DESCRIPTION =
  "Borrow tools from neighbors, save money, and build community";
const INPUT_PLACEHOLDER = "What are you looking for?";

//  Value Proposition
const VALUE_PROPOSITION_TITLE = "Save Time, Make Money";
const VALUE_PROPOSITION_DESCRIPTION =
  "Tools from a hyper-local marketplace are cheaper than renting or buying from big box stores. Leverage what you already have to make money.";
const VALUE_PROPOSITION_BUTTON = "Explore all categories";
const CATEGORY_CARDS = [
  {
    title: "Power & Hand Tools",
    description:
      "Drills, saws, sanders, and more available in your neighborhood.",
    imageUrl: "/assorted-power-tools.png",
    icon: <Tool className="h-6 w-6" />,
  },
  {
    title: "Trucks & Trailers",
    description: "Moving? Need to haul something? Your neighbors can help.",
    imageUrl: "/truck-and-trailer.png",
    icon: <Truck className="h-6 w-6" />,
  },
  {
    title: "Lawn & Garden",
    description: "Mowers, trimmers, pressure washers, and more for your yard.",
    imageUrl: "/lawn-mower-tools.png",
    icon: <Home className="h-6 w-6" />,
  },
];

// Community Section
const COMMUNITY_TITLE = "Neighbor-to-neighborhood";
const COMMUNITY_DESCRIPTION =
  "Trust in a community marketplace that is limited to households in your neighborhood. Build connections while sharing resources.";
const FEATURED_CARDS = [
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
];
const COMMUNITY_SECTION_BUTTON_LABEL = "Join Hoador";

// How it works section
const HOW_IT_WORKS_TITLE = "How Hoador works";
const HOW_IT_WORKS_DESCRIPTION =
  "Simple, secure, and designed to build community";
const HOW_IT_WORKS_ITEMS = [
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
];
const HOW_IT_WORKS_BUTTON_LABEL = "Learn more about our process";

// CTA Section
const CTA_TITLE = "Ready to join your neighborhood marketplace?";
const CTA_DESCRIPTION =
  "Sign up today and start sharing tools with your neighbors";
const CTA_BUTTON_LABEL = "Get started";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="bg-background/95 mobile-padding supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/hoador-logo.svg"
              alt="Hoador Logo"
              width={100}
              height={40}
              className="h-6 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              {LOG_IN}
            </Link>
            <Button asChild className="rounded-full">
              <Link href="/signup">{SIGN_UP}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mobile-padding bg-[linear-gradient(to_bottom,theme(colors.background)_0%,theme(colors.skyBlue)_60%,theme(colors.skyBlue)_100%)] relative overflow-hidden pt-16 md:pt-24">
        <div className="relative z-10 container mx-auto flex flex-col items-center justify-center">
          <FadeIn>
            <div className="max-w-3xl text-center">
              <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                {HERO_TITLE_A}{" "}
                <span className="text-primary">{HERO_TITLE_B}</span>
              </h1>
              <p className="text-muted-foreground mb-8 text-xl">
                {HERO_DESCRIPTION}
              </p>
              <div className="mx-auto mb-8 max-w-xl">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder={INPUT_PLACEHOLDER}
                    className="border-muted bg-background focus-visible:ring-primary h-12 rounded-full pr-4 pl-10 shadow-sm"
                  />
                </div>
              </div>
            </div>
          </FadeIn>
        </div>

        <div className="bg-skyBlue relative mt-8 flex w-full justify-center">
          <FadeIn
            delay={300}
            duration={1000}
            className="flex w-full justify-center"
          >
            <Image
              src="/images/cartoon.png"
              width={322}
              height={108}
              alt="Cartoon image of neighbors sharing tools"
              className="w-full md:w-1/2 lg:w-1/3"
            />
          </FadeIn>
        </div>
      </section>

      {/* Value Proposition */}
      <AnimatedSection className="mobile-padding py-16 md:py-24">
        <div className="container mx-auto flex flex-col items-center justify-center text-center">
          <div className="mb-16 max-w-3xl">
            <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
              <Coins className="text-primary h-10 w-10" />
            </div>
            <h2 className="text-primary mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {VALUE_PROPOSITION_TITLE}
            </h2>
            <p className="text-muted-foreground text-xl">
              {VALUE_PROPOSITION_DESCRIPTION}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_CARDS.map((categoryCard) => (
              <CategoryCard
                key={categoryCard.title}
                icon={categoryCard.icon}
                title={categoryCard.title}
                description={categoryCard.description}
                imageUrl={categoryCard.imageUrl}
              />
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/categories" className="flex items-center gap-2">
                {VALUE_PROPOSITION_BUTTON}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </AnimatedSection>

      {/* Community Section */}
      <AnimatedSection className="bg-accent mobile-padding py-16 md:py-24">
        <div className="container mx-auto flex flex-col items-center justify-center">
          <div className="mb-16 max-w-3xl text-center">
            <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
              <Home className="text-primary h-10 w-10" />
            </div>
            <h2 className="text-primary mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {COMMUNITY_TITLE}
            </h2>
            <p className="text-muted-foreground text-xl">
              {COMMUNITY_DESCRIPTION}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {FEATURED_CARDS.map((featureCard) => (
              <FeatureCard
                key={featureCard.title}
                icon={featureCard.icon}
                title={featureCard.title}
                description={featureCard.description}
                benefits={featureCard.benefits}
                variant={featureCard.variant as "default" | "primary"}
              />
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/signup">{COMMUNITY_SECTION_BUTTON_LABEL}</Link>
            </Button>
          </div>
        </div>
      </AnimatedSection>

      {/* How It Works */}
      <AnimatedSection className="mobile-padding py-16 md:py-24">
        <div className="container mx-auto flex flex-col items-center justify-center">
          <div className="mb-16 max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {HOW_IT_WORKS_TITLE}
            </h2>
            <p className="text-muted-foreground text-xl">
              {HOW_IT_WORKS_DESCRIPTION}{" "}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS_ITEMS.map((howItWorksItem) => (
              <div key={howItWorksItem.id} className="text-center">
                <div className="bg-primary text-primary-foreground mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold">
                  {howItWorksItem.id}
                </div>
                <h3 className="mb-2 text-xl font-semibold">
                  {howItWorksItem.title}
                </h3>
                <p className="text-muted-foreground">
                  {howItWorksItem.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              <Link href="/how-it-works">{HOW_IT_WORKS_BUTTON_LABEL}</Link>
            </Button>
          </div>
        </div>
      </AnimatedSection>

      {/* CTA Section */}
      <AnimatedSection className="bg-primary mobile-padding text-primary-foreground py-16 md:py-24">
        <div className="container mx-auto flex flex-col items-center justify-center">
          <div className="max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {CTA_TITLE}
            </h2>
            <p className="mb-8 text-xl opacity-90">{CTA_DESCRIPTION} </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="rounded-full"
            >
              <Link href="/signup">{CTA_BUTTON_LABEL}</Link>
            </Button>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
