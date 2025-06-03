import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Coins, Search, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CategoryCard from "@/components/category-card";
import FeatureCard from "@/components/feature-card";
import FadeIn from "@/components/fade-in";
import AnimatedSection from "@/components/animated-section";
import { HOME_PAGE } from "@/lib/constants/home";

const { header, hero, valueProp, community, howItWorks, cta } = HOME_PAGE;

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
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              {header.logIn}
            </Link>
            <Button asChild className="rounded-full">
              <Link href="/signup">{header.signUp}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <FadeIn>
        <section className="mobile-padding bg-[linear-gradient(to_bottom,theme(colors.background)_0%,theme(colors.skyBlue)_60%,theme(colors.skyBlue)_100%)] relative overflow-hidden pt-16 md:pt-24">
          <div className="relative z-10 container mx-auto flex flex-col items-center justify-center">
            <div className="max-w-3xl text-center">
              <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                {hero.titleA}{" "}
                <span className="text-primary">{hero.titleB}</span>
              </h1>
              <p className="text-muted-foreground mb-8 text-xl">
                {hero.description}
              </p>
              <div className="mx-auto mb-8 max-w-xl">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder={hero.inputPlaceholder}
                    className="border-muted bg-background focus-visible:ring-primary h-12 rounded-full pr-4 pl-10 shadow-sm"
                  />
                </div>
              </div>
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
      <AnimatedSection className="mobile-padding py-16 md:py-24">
        <div className="container mx-auto flex flex-col items-center justify-center text-center">
          <div className="mb-16 max-w-3xl">
            <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
              <Coins className="text-primary h-10 w-10" />
            </div>
            <h2 className="text-primary mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {valueProp.title}
            </h2>
            <p className="text-muted-foreground text-xl">
              {valueProp.description}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {valueProp.categoryCards.map((categoryCard) => (
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
                {valueProp.buttonLabel}
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
              {community.title}
            </h2>
            <p className="text-muted-foreground text-xl">
              {community.description}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {community.featuredCards.map((featureCard) => (
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
              <Link href="/signup">{community.buttonLabel}</Link>
            </Button>
          </div>
        </div>
      </AnimatedSection>

      {/* How It Works */}
      <AnimatedSection className="mobile-padding py-16 md:py-24">
        <div className="container mx-auto flex flex-col items-center justify-center">
          <div className="mb-16 max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {howItWorks.title}
            </h2>
            <p className="text-muted-foreground text-xl">
              {howItWorks.description}{" "}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {howItWorks.items.map((howItWorksItem) => (
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
              <Link href="/how-it-works">{howItWorks.buttonLabel}</Link>
            </Button>
          </div>
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
