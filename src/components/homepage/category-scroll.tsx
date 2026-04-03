"use client";

import * as React from "react";
import { motion } from "framer-motion";

import CategoryCard from "@/components/homepage/category-card";
import StaggeredChildren, {
  StaggeredItem,
} from "@/components/homepage/staggered-children";
import type { UseCaseCategory } from "@/constants/home";
import { cn } from "@/lib/utils";

const GAP_PX = 16;

export interface CategoryScrollProps {
  readonly categories: readonly UseCaseCategory[];
}

/**
 * Mobile: horizontal snap strip with peek, fade hint, and animated dot indicators.
 * Desktop: staggered grid (unchanged layout).
 */
export function CategoryScroll({ categories }: CategoryScrollProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const updateActiveIndex = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el || categories.length === 0) return;
    const first = el.children[0] as HTMLElement | undefined;
    if (!first) return;
    const step = first.offsetWidth + GAP_PX;
    if (step <= 0) return;
    const idx = Math.round(el.scrollLeft / step);
    setActiveIndex(Math.min(Math.max(0, idx), categories.length - 1));
  }, [categories.length]);

  React.useEffect(() => {
    updateActiveIndex();
  }, [updateActiveIndex]);

  React.useEffect(() => {
    const onResize = () => updateActiveIndex();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateActiveIndex]);

  return (
    <div className="md:container md:mx-auto">
      <div className="-mx-6 overflow-hidden md:mx-0 md:overflow-visible">
        <div className="relative">
          <StaggeredChildren
            ref={scrollRef}
            staggerDelay={0.12}
            onScroll={updateActiveIndex}
            className={cn(
              "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none]",
              "pl-6 pr-6",
              "[&::-webkit-scrollbar]:hidden",
              "md:grid md:grid-cols-2 md:gap-8 md:overflow-visible md:px-0 lg:grid-cols-3",
            )}
          >
            {categories.map((categoryCard) => (
              <StaggeredItem
                key={categoryCard.title}
                className="h-full w-[82vw] max-w-[20rem] shrink-0 snap-center md:w-auto md:max-w-none"
              >
                <CategoryCard
                  iconName={categoryCard.iconName}
                  title={categoryCard.title}
                  description={categoryCard.description}
                  imageUrl={categoryCard.imageUrl}
                />
              </StaggeredItem>
            ))}
          </StaggeredChildren>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-1 w-12 bg-linear-to-l from-background to-transparent md:hidden"
            aria-hidden
          />
        </div>
        <div
          className="mt-4 flex justify-center gap-2 md:hidden"
          role="tablist"
          aria-label="Category slides"
        >
          {categories.map((_, i) => (
            <motion.div
              key={`category-dot-${i}`}
              layout
              animate={{
                width: i === activeIndex ? 20 : 8,
                opacity: i === activeIndex ? 1 : 0.35,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="bg-primary h-2 rounded-full"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
