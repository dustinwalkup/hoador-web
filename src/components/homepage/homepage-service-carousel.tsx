"use client";

import * as React from "react";
import AutoScroll from "embla-carousel-auto-scroll";

import { HomepageServiceCard } from "@/components/homepage/homepage-service-card";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { usePauseAutoscrollOnWindowScroll } from "@/lib/hooks/use-pause-autoscroll-on-window-scroll";
import {
  HOMEPAGE_CAROUSEL_EMBA_OPTS,
  HOMEPAGE_SERVICE_CAROUSEL_AUTO_SCROLL,
  type HomepageServiceMock,
} from "@/constants/home";

export interface HomepageServiceCarouselProps {
  readonly services: readonly HomepageServiceMock[];
  readonly title: string;
  readonly description?: string;
}

/**
 * Continuously scrolling service carousel for the marketing homepage (mock services).
 */
export function HomepageServiceCarousel({
  services,
  title,
  description,
}: HomepageServiceCarouselProps) {
  const plugin = React.useRef(
    AutoScroll({ ...HOMEPAGE_SERVICE_CAROUSEL_AUTO_SCROLL }),
  );
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  usePauseAutoscrollOnWindowScroll(carouselApi);

  return (
    <div className="w-full">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            {description}
          </p>
        ) : null}
      </div>
      <Carousel
        opts={HOMEPAGE_CAROUSEL_EMBA_OPTS}
        plugins={[plugin.current]}
        setApi={setCarouselApi}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {services.map((service) => (
            <CarouselItem
              key={service.id}
              className="flex h-full basis-full pl-2 md:basis-1/2 md:pl-4 lg:basis-1/3"
            >
              <div className="h-full w-full min-w-0">
                <HomepageServiceCard service={service} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="flex h-9 w-9" />
        <CarouselNext className="flex h-9 w-9" />
      </Carousel>
    </div>
  );
}
