import { describe, it, expect, vi } from "vitest";
import type { ReactNode as ReactNodeType } from "react";
import { render, screen } from "@testing-library/react";
import { NeighborhoodActivityWidget } from "../neighborhood-activity-widget";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNodeType; href: string }) => (
    <a href={href}>{children as ReactNodeType}</a>
  ),
}));

describe("NeighborhoodActivityWidget", () => {
  it("should return null when listings array is empty", () => {
    const { container } = render(<NeighborhoodActivityWidget listings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render listings with name and link from props", () => {
    const listings = [
      {
        id: "listing-1",
        name: "Drill nearby",
        linkTo: "/dashboard/listings/listing-1",
      },
    ];
    render(<NeighborhoodActivityWidget listings={listings} />);

    expect(screen.getByText("Drill nearby")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Drill nearby/i });
    expect(link).toHaveAttribute("href", "/dashboard/listings/listing-1");
  });

  it("should link Browse More to explore", () => {
    const listings = [
      { id: "l1", name: "Saw", linkTo: "/dashboard/listings/l1" },
    ];
    render(<NeighborhoodActivityWidget listings={listings} />);
    const browseMore = screen.getByRole("link", { name: /Browse More/i });
    expect(browseMore).toHaveAttribute("href", "/dashboard/explore");
  });
});
