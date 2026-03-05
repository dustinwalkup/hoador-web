import { describe, it, expect } from "vitest";
import { containerVariants, fieldVariants } from "../animated-form-field";

describe("fieldVariants", () => {
  it("should have correct hidden state", () => {
    expect(fieldVariants.hidden).toEqual({
      opacity: 0,
      y: 20,
      filter: "blur(4px)",
    });
  });

  it("should have correct visible state", () => {
    expect(fieldVariants.visible).toMatchObject({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.4,
        ease: "easeOut",
      },
    });
  });
});

describe("containerVariants", () => {
  it("should have correct hidden state", () => {
    expect(containerVariants.hidden).toEqual({ opacity: 0 });
  });

  it("should have correct visible state with stagger", () => {
    expect(containerVariants.visible).toMatchObject({
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.1,
      },
    });
  });
});
