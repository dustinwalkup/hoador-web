import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { HOME_PAGE } from "@/constants/home";
import { HowPaymentsWorkModal } from "@/components/payments/how-payments-work-modal";
import {
  howItWorksFaqItems,
  ownerProviderSteps,
  renterClientSteps,
} from "@/components/how-hoador-works-data";

const { header } = HOME_PAGE;

export function generateMetadata(): Metadata {
  return {
    title: "How Hoador Works",
    description:
      "Learn how to rent tools and book services from neighbors, or list what you own and get paid — all in a few simple steps.",
    alternates: {
      canonical: "/how-it-works",
    },
    openGraph: {
      title: "How Hoador Works | Hoador",
      description:
        "Rent anything from neighbors. Offer what you own or do. Find, request, and meet — or list, accept, and get paid.",
    },
  };
}

export default function HowItWorksPage() {
  return (
    <div className="bg-background min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo
              width={100}
              height={40}
              style={{ height: "1.5rem", width: "auto" }}
              absolutePosition="-right-14!"
              showBetaTag
            />
            <span className="sr-only">Hoador home</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {header.logIn}
            </Link>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/signup">{header.signUp}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-12 md:py-16">
        <section
          aria-labelledby="how-it-works-hero"
          className="mx-auto max-w-2xl text-center"
        >
          <h1
            id="how-it-works-hero"
            className="text-foreground text-3xl font-semibold tracking-tight md:text-4xl"
          >
            How Hoador Works
          </h1>
          <p className="text-muted-foreground mt-4 text-lg md:text-xl">
            Rent anything from neighbors. Offer what you own or do.
          </p>
        </section>

        <section
          aria-labelledby="renters-clients-heading"
          className="mt-14 md:mt-20"
        >
          <h2
            id="renters-clients-heading"
            className="text-foreground mb-6 text-center text-xl font-semibold md:text-2xl"
          >
            For renters &amp; clients
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {renterClientSteps.map((step, index) => (
              <Card
                key={step.title}
                className="border-muted/80 shadow-sm transition-shadow hover:shadow-md"
              >
                <CardHeader className="pb-2">
                  <div className="bg-primary/10 text-primary mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                    <step.Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <CardTitle className="text-base font-semibold">
                    <span className="text-muted-foreground mr-2 font-normal">
                      {index + 1}.
                    </span>
                    {step.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="owners-providers-heading"
          className="mt-14 md:mt-20"
        >
          <h2
            id="owners-providers-heading"
            className="text-foreground mb-6 text-center text-xl font-semibold md:text-2xl"
          >
            For owners &amp; providers
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {ownerProviderSteps.map((step, index) => (
              <Card
                key={step.title}
                className="border-muted/80 shadow-sm transition-shadow hover:shadow-md"
              >
                <CardHeader className="pb-2">
                  <div className="bg-primary/10 text-primary mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                    <step.Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <CardTitle className="text-base font-semibold">
                    <span className="text-muted-foreground mr-2 font-normal">
                      {index + 1}.
                    </span>
                    {step.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="faq-heading"
          className="border-muted/60 bg-muted/30 mt-14 rounded-xl border p-6 md:mt-20 md:p-8"
        >
          <h2
            id="faq-heading"
            className="text-foreground mb-4 text-center text-lg font-semibold"
          >
            Common questions
          </h2>
          <div className="mx-auto flex max-w-lg flex-col gap-2">
            {howItWorksFaqItems.map((item) => (
              <details
                key={item.question}
                className="group border-muted rounded-lg border"
              >
                <summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="text-muted-foreground px-4 pb-4 text-sm leading-relaxed">
                  <p>{item.answer}</p>
                  {item.question === "How does payment work?" && (
                    <p className="mt-2">
                      <HowPaymentsWorkModal className="text-sm" />
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>

        <footer className="mt-14 flex flex-col items-center gap-4 border-t pt-10 text-center md:mt-20">
          <p className="text-muted-foreground text-sm">Ready to get started?</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </footer>
      </main>
    </div>
  );
}
