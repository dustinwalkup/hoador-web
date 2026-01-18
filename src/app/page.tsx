import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Coins, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import CategoryCard from "@/components/category-card";
import FeatureCard from "@/components/feature-card";
import FadeIn from "@/components/fade-in";
import AnimatedSection from "@/components/animated-section";
import { HomeHeader } from "@/components/home-header";
import { HOME_PAGE, structuredData } from "@/constants/home";
import StaggeredChildren, {
  StaggeredItem,
} from "@/components/staggered-children";

// Base URL - Update this with your production domain
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://hoador.com";

const { hero, valueProp, community, howItWorks, cta } = HOME_PAGE;

// Comprehensive metadata for SEO
export const metadata: Metadata = {
  title: "Hoador - Your Neighborhood Tool Rental Marketplace",
  description:
    "Borrow tools from neighbors, save money, and build community. Rent power tools, lawn equipment, and more in your neighborhood marketplace.",
  keywords: [
    "tool rental",
    "neighborhood marketplace",
    "borrow tools",
    "rent tools",
    "community sharing",
    "power tools",
    "lawn equipment",
    "hand tools",
    "tool sharing",
    "local marketplace",
  ],
  authors: [{ name: "Hoador" }],
  creator: "Hoador",
  publisher: "Hoador",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Hoador - Your Neighborhood Tool Rental Marketplace",
    description:
      "Borrow tools from neighbors, save money, and build community. Rent power tools, lawn equipment, and more in your neighborhood marketplace.",
    url: baseUrl,
    siteName: "Hoador",
    images: [
      {
        url: `${baseUrl}/images/cartoon.png`,
        width: 322,
        height: 108,
        alt: "Neighbors sharing tools in the Hoador community marketplace",
      },
      {
        url: `${baseUrl}/hoador-logo.svg`,
        width: 100,
        height: 40,
        alt: "Hoador Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hoador - Your Neighborhood Tool Rental Marketplace",
    description:
      "Borrow tools from neighbors, save money, and build community. Rent power tools, lawn equipment, and more.",
    images: [`${baseUrl}/images/cartoon.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your verification codes here when available
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // yahoo: "your-yahoo-verification-code",
  },
};

export default function HomePage() {
  return (
    <div className="mt-8! flex min-h-screen flex-col">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* Header */}
      <HomeHeader />

      {/* Hero Section */}
      <FadeIn>
        <section className="mobile-padding relative overflow-hidden bg-[linear-gradient(to_bottom,var(--color-background)_0%,var(--color-skyBlue)_60%,var(--color-skyBlue)_100%)] pt-24 md:pt-24">
          <div className="relative z-10 container mx-auto flex flex-col items-center justify-center">
            <div className="max-w-3xl text-center">
              <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                {hero.titleA}{" "}
                <span className="text-primary">{hero.titleB}</span>
              </h1>
              <p className="text-muted-foreground mb-8 text-xl">
                {hero.description}
              </p>
            </div>
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
      </FadeIn>

      {/* Value Proposition */}
      <AnimatedSection
        className="mobile-padding py-16 md:py-24"
        parallax={true}
        parallaxOffset={30}
      >
        <div className="container mx-auto flex flex-col items-center justify-center text-center">
          <div className="mb-16 max-w-3xl">
            <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
              <Coins className="text-primary h-10 w-10" />
            </div>
            <h2 className="text-primary mb-4 text-3xl font-bold tracking-tight md:h-[80px] md:text-4xl">
              {valueProp.title}
            </h2>
            <p className="text-muted-foreground text-xl md:h-[84px]">
              {valueProp.description}
            </p>
          </div>

          <StaggeredChildren className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {valueProp.categoryCards.map((categoryCard) => (
              <StaggeredItem key={categoryCard.title}>
                <CategoryCard
                  iconName={categoryCard.iconName}
                  title={categoryCard.title}
                  description={categoryCard.description}
                  imageUrl={categoryCard.imageUrl}
                />
              </StaggeredItem>
            ))}
          </StaggeredChildren>
        </div>
      </AnimatedSection>

      {/* Community Section */}
      <div className="bg-accent mobile-padding py-16 md:py-24">
        <AnimatedSection>
          <div className="container mx-auto flex flex-col items-center justify-center">
            <div className="mb-16 max-w-3xl text-center">
              <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
                <Home className="text-primary h-10 w-10" />
              </div>
              <h2 className="text-primary mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                {community.title}
              </h2>
              <p className="text-muted-foreground text-xl">
                {community.description}
              </p>
            </div>

            <StaggeredChildren
              className="grid gap-8 md:grid-cols-2"
              staggerDelay={0.2}
            >
              {community.featuredCards.map((featureCard) => (
                <StaggeredItem key={featureCard.title}>
                  <FeatureCard
                    iconName={featureCard.iconName}
                    title={featureCard.title}
                    description={featureCard.description}
                    benefits={featureCard.benefits}
                    variant={featureCard.variant as "default" | "primary"}
                  />
                </StaggeredItem>
              ))}
            </StaggeredChildren>

            <div className="mt-12 text-center">
              <Button asChild size="lg" className="rounded-full">
                <Link href="/signup">{community.buttonLabel}</Link>
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </div>

      {/* How It Works */}
      <AnimatedSection
        className="mobile-padding py-16 md:py-24"
        parallax
        parallaxOffset={20}
      >
        <div className="container mx-auto flex flex-col items-center justify-center">
          <div className="mb-16 max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {howItWorks.title}
            </h2>
            <p className="text-muted-foreground text-xl">
              {howItWorks.description}{" "}
            </p>
          </div>

          <StaggeredChildren
            className="grid gap-8 md:grid-cols-3"
            staggerDelay={0.2}
          >
            {howItWorks.items.map((howItWorksItem) => (
              <StaggeredItem key={howItWorksItem.id}>
                <div className="text-center">
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
              </StaggeredItem>
            ))}
          </StaggeredChildren>
        </div>
      </AnimatedSection>

      {/* CTA Section */}
      <AnimatedSection className="bg-primary mobile-padding text-primary-foreground py-16 md:py-24">
        <div className="container mx-auto flex flex-col items-center justify-center">
          <div className="max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {cta.title}
            </h2>
            <p className="mb-8 text-xl opacity-90">{cta.description} </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="rounded-full"
            >
              <Link href="/signup">{cta.buttonLabel}</Link>
            </Button>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
