import Image from "next/image";
import type { Metadata } from "next";
import { CheckCircle, Home, Shield } from "lucide-react";

import {
  AnimatedSection,
  HomeHeader,
  FadeIn,
  CategoryScroll,
  HomepageListingCarousel,
  HomepageServiceCarousel,
} from "@/components/homepage/";
import { HOME_PAGE, structuredData } from "@/constants/home";
import StaggeredChildren, {
  StaggeredItem,
} from "@/components/homepage/staggered-children";
import { RequestHoadorButton } from "@/features/hoa-inquiries/components/request-hoador-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Base URL - Update this with your production domain
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.hoador.com";

const {
  hero,
  useCaseCategories,
  listingCarousel,
  homepageListings,
  serviceCarousel,
  homepageServices,
  requestHoador,
  community,
  trustSafety,
  howItWorks,
  cta,
} = HOME_PAGE;

// Comprehensive metadata for SEO
export const metadata: Metadata = {
  title: "Hoador - Neighborhood Rentals & Local Services",
  description:
    "Borrow tools, book local help, and share with neighbors in approved communities. Rentals, services, and everyday items close to home.",
  keywords: [
    "neighborhood marketplace",
    "local services",
    "tool rental",
    "community rentals",
    "HOA marketplace",
    "borrow tools",
    "yard services",
    "neighbor sharing",
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
    title: "Hoador - Neighborhood Rentals & Local Services",
    description:
      "Borrow tools, book local help, and share with neighbors in approved communities.",
    url: baseUrl,
    siteName: "Hoador",
    images: [
      {
        url: `${baseUrl}/images/cartoon.png`,
        width: 322,
        height: 108,
        alt: "Neighbors sharing in the Hoador community marketplace",
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
    title: "Hoador - Neighborhood Rentals & Local Services",
    description:
      "Borrow tools, book local help, and share with neighbors in approved communities.",
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

      {/* Hero Section — full viewport height (minus header clearance via pt-24) */}
      <section className="mobile-padding relative -mt-[30px] flex min-h-dvh flex-col overflow-hidden bg-[linear-gradient(to_bottom,var(--color-background)_0%,var(--color-skyBlue)_60%,var(--color-skyBlue)_100%)] pt-24 md:pt-24">
        <div className="relative z-10 container mx-auto flex flex-1 flex-col items-center justify-center">
          <div className="max-w-3xl text-center">
            <h1 className="mb-6 flex flex-wrap justify-center gap-x-2 gap-y-1 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              <FadeIn asSpan direction="left" delay={0} scale={false}>
                {hero.titleA}
              </FadeIn>
              <FadeIn asSpan direction="right" delay={0} scale={false}>
                <span className="text-primary">{hero.titleB}</span>
              </FadeIn>
            </h1>
            <FadeIn delay={400} direction="up" scale={false}>
              <p className="text-muted-foreground mb-6 text-xl">
                {hero.description}
              </p>
            </FadeIn>
            <StaggeredChildren
              className="mb-8 flex flex-wrap justify-center gap-2"
              delay={700}
              staggerDelay={0.1}
            >
              {hero.chips.map((chip) => (
                <StaggeredItem key={chip}>
                  <Badge
                    variant="secondary"
                    className="px-3 py-1 text-sm font-normal"
                  >
                    {chip}
                  </Badge>
                </StaggeredItem>
              ))}
            </StaggeredChildren>
            <FadeIn
              delay={1100}
              direction="up"
              spring
              className="flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <RequestHoadorButton label={requestHoador.buttonLabel} />
              <Button variant="outline" size="lg" asChild>
                <a href={hero.secondaryCtaHref}>{hero.secondaryCtaLabel}</a>
              </Button>
            </FadeIn>
          </div>
        </div>

        <div className="bg-skyBlue relative -mx-6 mt-auto flex shrink-0 justify-center md:mx-0 md:w-full md:pt-8">
          <FadeIn
            delay={1300}
            direction="up"
            spring
            className="flex w-full justify-center"
          >
            <Image
              src="/images/cartoon.png"
              width={644}
              height={210}
              alt="Cartoon image of neighbors sharing tools"
              className="w-[150%] max-w-none shrink-0 md:w-3/4 md:max-w-full lg:w-1/2"
            />
          </FadeIn>
        </div>
      </section>

      {/* Category / use cases */}
      <AnimatedSection className="mobile-padding py-16 md:py-20">
        <CategoryScroll categories={useCaseCategories} />
      </AnimatedSection>

      {/* Featured listings (rentals) carousel */}
      <AnimatedSection
        className="mobile-padding bg-primary-light py-16 md:py-24"
        parallax
        parallaxOffset={15}
      >
        <div className="container mx-auto">
          <FadeIn>
            <HomepageListingCarousel
              title={listingCarousel.title}
              description={listingCarousel.description}
              listings={homepageListings}
            />
          </FadeIn>
        </div>
      </AnimatedSection>

      {/* Services carousel */}
      <AnimatedSection className="mobile-padding py-16 md:py-24">
        <div className="container mx-auto">
          <FadeIn delay={100}>
            <HomepageServiceCarousel
              title={serviceCarousel.title}
              description={serviceCarousel.description}
              services={homepageServices}
            />
          </FadeIn>
        </div>
      </AnimatedSection>

      {/* How It Works */}
      <AnimatedSection
        id="how-it-works"
        className="mobile-padding bg-accent py-16 md:py-24"
        parallax
        parallaxOffset={20}
      >
        <div className="container mx-auto flex flex-col items-center justify-center">
          <div className="mb-16 max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {howItWorks.title}
            </h2>
            <p className="text-muted-foreground text-xl">
              {howItWorks.description}
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

      {/* Value / community */}
      <div className="mobile-padding py-16 md:py-24">
        <AnimatedSection>
          <div className="container mx-auto flex flex-col items-center justify-center pb-8">
            <div className="mb-12 max-w-3xl text-center">
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
              className="mx-auto grid max-w-2xl gap-4"
              staggerDelay={0.12}
            >
              {community.benefits.map((benefit) => (
                <StaggeredItem key={benefit}>
                  <div className="bg-card flex items-start gap-3 rounded-xl border p-4 shadow-sm">
                    <CheckCircle className="text-primary mt-0.5 h-6 w-6 shrink-0" />
                    <p className="text-lg">{benefit}</p>
                  </div>
                </StaggeredItem>
              ))}
            </StaggeredChildren>
          </div>
        </AnimatedSection>
      </div>

      {/* Trust & safety */}
      <AnimatedSection
        className="mobile-padding bg-primary-light py-16 md:py-24"
        parallax
        parallaxOffset={25}
      >
        <div className="container mx-auto">
          <div className="mb-12 max-w-3xl text-center md:mx-auto">
            <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
              <Shield className="text-primary h-10 w-10" />
            </div>
            <h2 className="text-primary mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {trustSafety.title}
            </h2>
          </div>
          <StaggeredChildren
            className="grid gap-6 md:grid-cols-2"
            staggerDelay={0.1}
          >
            {trustSafety.points.map((point) => (
              <StaggeredItem key={point}>
                <div className="bg-card flex h-full items-start gap-3 rounded-xl border p-6 shadow-sm">
                  <CheckCircle className="text-primary mt-0.5 h-6 w-6 shrink-0" />
                  <p className="text-muted-foreground text-lg">{point}</p>
                </div>
              </StaggeredItem>
            ))}
          </StaggeredChildren>
        </div>
      </AnimatedSection>

      {/* HOA request CTA */}
      <AnimatedSection className="mobile-padding py-16 md:py-20">
        <div className="container mx-auto flex flex-col items-center justify-center text-center">
          <div className="max-w-2xl">
            <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">
              {requestHoador.title}
            </h2>
            <p className="text-muted-foreground mb-6 text-lg">
              {requestHoador.description}
            </p>
            <RequestHoadorButton label={requestHoador.buttonLabel} />
          </div>
        </div>
      </AnimatedSection>

      {/* Final CTA */}
      <AnimatedSection className="bg-primary mobile-padding text-primary-foreground py-16 md:py-24">
        <div className="container mx-auto flex flex-col items-center justify-center">
          <div className="max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {cta.title}
            </h2>
            <p className="mb-8 text-xl opacity-90">{cta.description}</p>
            <RequestHoadorButton label={cta.buttonLabel} variant="secondary" />
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
