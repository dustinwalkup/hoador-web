import { describe, it, expect } from "vitest";
import {
  createListingSchemaServer,
  createListingSchemaClient,
  listingConditionSchema,
  deliveryModeSchema,
  imageFileSchema,
  type CreateListingFormDataServerType,
  type CreateListingFormDataClientType,
  type ImageFile,
} from "../listing.schema";

describe("listing.schema.ts", () => {
  describe("listingConditionSchema", () => {
    it("should accept valid condition values", () => {
      const validConditions = ["new", "good", "fair", "poor"];

      validConditions.forEach((condition) => {
        const result = listingConditionSchema.safeParse(condition);
        expect(result.success).toBe(true);
        expect(result.data).toBe(condition);
      });
    });

    it("should reject invalid condition values", () => {
      const invalidConditions = [
        "",
        "excellent",
        "used",
        "broken",
        null,
        undefined,
      ];

      invalidConditions.forEach((condition) => {
        const result = listingConditionSchema.safeParse(condition);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("deliveryModeSchema", () => {
    it("should accept valid delivery mode values", () => {
      const validModes = ["pickup_only", "delivery_only", "both_available"];

      validModes.forEach((mode) => {
        const result = deliveryModeSchema.safeParse(mode);
        expect(result.success).toBe(true);
        expect(result.data).toBe(mode);
      });
    });

    it("should reject invalid delivery mode values", () => {
      const invalidModes = ["", "pickup", "delivery", "none", null, undefined];

      invalidModes.forEach((mode) => {
        const result = deliveryModeSchema.safeParse(mode);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("imageFileSchema", () => {
    it("should accept valid image file data", () => {
      const validImage: ImageFile = {
        file: new File([""], "test.jpg"),
        url: "https://example.com/image.jpg",
        id: "img-123",
        orderIndex: 0,
      };

      const result = imageFileSchema.safeParse(validImage);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validImage);
    });

    it("should accept partial image file data", () => {
      const partialImage: ImageFile = {
        url: "https://example.com/image.jpg",
      };

      const result = imageFileSchema.safeParse(partialImage);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(partialImage);
    });

    it("should accept empty image file object", () => {
      const emptyImage: ImageFile = {};

      const result = imageFileSchema.safeParse(emptyImage);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(emptyImage);
    });
  });

  describe("createListingSchemaServer", () => {
    describe("valid data acceptance", () => {
      it("should accept valid minimal listing data", () => {
        const validData: CreateListingFormDataServerType = {
          name: "Power Drill",
          description: "A heavy-duty power drill",
          categoryId: "category-123",
          condition: "good",
          dailyRate: 15.0,
          securityDeposit: 0,
          specifications: {},
          minimumRentalPeriod: 1,
          maximumRentalPeriod: 30,
          deliveryMode: "pickup_only",
          deliveryFee: 0,
          deliveryRadius: 0,
          setupAvailable: false,
          setupFee: 0,
        };

        const result = createListingSchemaServer.safeParse(validData);
        expect(result.success).toBe(true);
        // Schema applies defaults, so result should include specifications: {}
        expect(result.data).toEqual({
          ...validData,
          specifications: {},
        });
      });

      it("should accept valid complete listing data", () => {
        const completeData: CreateListingFormDataServerType = {
          name: "DeWalt Cordless Drill",
          description:
            "Professional-grade cordless drill with brushless motor and 20V MAX battery system. Perfect for contractors and serious DIY enthusiasts.",
          categoryId: "power-tools",
          brand: "DeWalt",
          model: "DCD777C2",
          condition: "good",
          dailyRate: 25.99,
          weeklyRate: 150.0,
          monthlyRate: 500.0,
          securityDeposit: 100.0,
          specifications: {
            power: "20V MAX",
            weight: "3.4 lbs",
            dimensions: '8.5" x 3.8" x 8.9"',
            material: "plastic and metal",
            chuckSize: "1/2 inch",
          },
          instructions:
            "Insert battery, select speed setting, and use trigger to operate. Use keyless chuck to change bits.",
          safetyNotes:
            "Wear safety glasses. Keep hands away from rotating parts. Ensure workpiece is secured before drilling.",
          minimumRentalPeriod: 1,
          maximumRentalPeriod: 14,
          deliveryMode: "both_available",
          deliveryFee: 15.0,
          deliveryRadius: 25,
          setupAvailable: true,
          setupFee: 50.0,
        };

        const result = createListingSchemaServer.safeParse(completeData);
        expect(result.success).toBe(true);
        // Server schema doesn't include images, so result should match completeData
        if (result.success) {
          expect(result.data).toEqual(completeData);
        }
      });

      it("should apply default values", () => {
        const dataWithDefaults = {
          name: "Hammer",
          description: "A basic hammer",
          categoryId: "hand-tools",
          condition: "good",
          dailyRate: 5.0,
          // Omitting optional/default fields
        };

        const result = createListingSchemaServer.safeParse(dataWithDefaults);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.securityDeposit).toBe(0);
          expect(result.data.minimumRentalPeriod).toBe(1);
          expect(result.data.maximumRentalPeriod).toBe(30);
          expect(result.data.deliveryMode).toBe("pickup_only");
          expect(result.data.deliveryFee).toBe(0);
          expect(result.data.deliveryRadius).toBe(0);
          expect(result.data.setupAvailable).toBe(false);
          expect(result.data.setupFee).toBe(0);
          expect(result.data.specifications).toEqual({});
        }
      });
    });

    describe("required field validation", () => {
      it("should reject missing name", () => {
        const data = {
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Invalid input: expected string, received undefined",
        );
      });

      it("should reject empty name", () => {
        const data = {
          name: "",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Listing name is required",
        );
      });

      it("should reject missing description", () => {
        const data = {
          name: "Drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Invalid input: expected string, received undefined",
        );
      });

      it("should reject empty description", () => {
        const data = {
          name: "Drill",
          description: "",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Description is required",
        );
      });

      it("should reject missing categoryId", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Invalid input: expected string, received undefined",
        );
      });

      it("should reject empty categoryId", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Category is required");
      });

      it("should reject missing condition", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.path).toContain("condition");
      });

      it("should reject missing dailyRate", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Daily rate is required");
      });
    });

    describe("boundary value testing", () => {
      it("should accept name at minimum length", () => {
        const data = {
          name: "D", // 1 character
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should accept name at maximum length", () => {
        const data = {
          name: "A".repeat(255), // 255 characters
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should reject name exceeding maximum length", () => {
        const data = {
          name: "A".repeat(256), // 256 characters
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
      });

      it("should accept description at minimum length", () => {
        const data = {
          name: "Drill",
          description: "D", // 1 character
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should accept description at maximum length", () => {
        const data = {
          name: "Drill",
          description: "A".repeat(2000), // 2000 characters
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should reject description exceeding maximum length", () => {
        const data = {
          name: "Drill",
          description: "A".repeat(2001), // 2001 characters
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
      });

      it("should accept dailyRate at minimum value", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 0.01, // minimum
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should reject dailyRate below minimum", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 0, // below minimum
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Daily rate must be greater than 0",
        );
      });

      it("should reject negative dailyRate", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: -10,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Daily rate must be greater than 0",
        );
      });

      it("should accept securityDeposit at minimum value", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          securityDeposit: 0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should reject negative securityDeposit", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          securityDeposit: -50,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Security deposit cannot be negative",
        );
      });

      it("should accept minimumRentalPeriod at minimum value", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          minimumRentalPeriod: 1,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should reject minimumRentalPeriod below minimum", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          minimumRentalPeriod: 0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Minimum rental period must be at least 1 day",
        );
      });

      it("should accept maximumRentalPeriod at minimum value", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          maximumRentalPeriod: 1,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should reject maximumRentalPeriod below minimum", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          maximumRentalPeriod: 0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Maximum rental period must be at least 1 day",
        );
      });

      it("should accept deliveryFee at minimum value", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          deliveryFee: 0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should reject negative deliveryFee", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          deliveryFee: -10,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Delivery fee cannot be negative",
        );
      });

      it("should accept deliveryRadius at minimum value", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          deliveryRadius: 0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should reject negative deliveryRadius", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          deliveryRadius: -5,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Delivery radius cannot be negative",
        );
      });

      it("should accept setupFee at minimum value", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          setupFee: 0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should reject negative setupFee", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          setupFee: -20,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Setup fee cannot be negative",
        );
      });
    });

    describe("conditional validation", () => {
      it("should allow pickup_only without delivery radius", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          deliveryMode: "pickup_only",
          deliveryRadius: 0,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should require delivery radius when delivery is available", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          deliveryMode: "delivery_only",
          deliveryRadius: 0, // Invalid: should be > 0
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Delivery radius is required when delivery is available",
        );
        expect(result.error?.issues[0]?.path).toContain("deliveryRadius");
      });

      it("should accept delivery radius when delivery is available", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          deliveryMode: "both_available",
          deliveryRadius: 25,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should require delivery when setup is available", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          deliveryMode: "pickup_only", // Invalid: cannot be pickup_only with setup
          setupAvailable: true,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
          "Setup service requires delivery to be available",
        );
        expect(result.error?.issues[0]?.path).toContain("setupAvailable");
      });

      it("should allow setup when delivery is available", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          deliveryMode: "delivery_only",
          deliveryRadius: 10,
          setupAvailable: true,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    describe("specifications validation", () => {
      it("should accept valid specifications object", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          specifications: {
            power: "20V",
            weight: "3.4 lbs",
            dimensions: '8.5" x 3.8" x 8.9"',
            material: "plastic and metal",
            chuckSize: 0.5,
            batteryIncluded: true,
            accessories: ["battery", "charger"],
          },
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should accept empty specifications", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          specifications: {},
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
      });

      it("should apply default empty specifications", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          // specifications not provided
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.specifications).toEqual({});
        }
      });
    });

    describe("optional field handling", () => {
      it("should handle optional brand field", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          brand: "DeWalt",
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.brand).toBe("DeWalt");
        }
      });

      it("should handle undefined brand field", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          brand: undefined,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.brand).toBeUndefined();
        }
      });

      it("should handle null brand field", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          brand: undefined,
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.brand).toBeUndefined();
        }
      });

      it("should handle optional text fields", () => {
        const data = {
          name: "Drill",
          description: "A drill",
          categoryId: "power-tools",
          condition: "good",
          dailyRate: 15.0,
          instructions: "Use carefully",
          safetyNotes: "Wear glasses",
        };

        const result = createListingSchemaServer.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.instructions).toBe("Use carefully");
          expect(result.data.safetyNotes).toBe("Wear glasses");
        }
      });
    });
  });

  describe("createListingSchemaClient", () => {
    it("should require at least one image", () => {
      const data: CreateListingFormDataClientType = {
        name: "Drill",
        description: "A drill",
        categoryId: "power-tools",
        condition: "good",
        dailyRate: 15.0,
        securityDeposit: 0,
        specifications: {},
        minimumRentalPeriod: 1,
        maximumRentalPeriod: 30,
        deliveryMode: "pickup_only",
        deliveryFee: 0,
        deliveryRadius: 0,
        setupAvailable: false,
        setupFee: 0,
        images: [], // Empty array should fail
        ownerPoliciesAcknowledged: true,
      };

      const result = createListingSchemaClient.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "At least one image is required",
      );
    });

    it("should require ownerPoliciesAcknowledged to be true", () => {
      const data: CreateListingFormDataClientType = {
        name: "Drill",
        description: "A drill",
        categoryId: "power-tools",
        condition: "good",
        dailyRate: 15.0,
        securityDeposit: 0,
        specifications: {},
        minimumRentalPeriod: 1,
        maximumRentalPeriod: 30,
        deliveryMode: "pickup_only",
        deliveryFee: 0,
        deliveryRadius: 0,
        setupAvailable: false,
        setupFee: 0,
        images: [
          {
            file: new File([""], "drill.jpg"),
            url: "https://example.com/drill.jpg",
          },
        ],
        ownerPoliciesAcknowledged: false, // Should fail
      };

      const result = createListingSchemaClient.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "You must acknowledge the Owner Policies to create a listing.",
      );
    });

    it("should accept valid data with ownerPoliciesAcknowledged true", () => {
      const data: CreateListingFormDataClientType = {
        name: "Drill",
        description: "A drill",
        categoryId: "power-tools",
        condition: "good",
        dailyRate: 15.0,
        securityDeposit: 0,
        specifications: {},
        minimumRentalPeriod: 1,
        maximumRentalPeriod: 30,
        deliveryMode: "pickup_only",
        deliveryFee: 0,
        deliveryRadius: 0,
        setupAvailable: false,
        setupFee: 0,
        images: [
          {
            file: new File([""], "drill.jpg"),
            url: "https://example.com/drill.jpg",
          },
        ],
        ownerPoliciesAcknowledged: true,
      };

      const result = createListingSchemaClient.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should accept valid images array", () => {
      const data: CreateListingFormDataClientType = {
        name: "Drill",
        description: "A drill",
        categoryId: "power-tools",
        condition: "good",
        dailyRate: 15.0,
        securityDeposit: 0,
        specifications: {},
        minimumRentalPeriod: 1,
        maximumRentalPeriod: 30,
        deliveryMode: "pickup_only",
        deliveryFee: 0,
        deliveryRadius: 0,
        setupAvailable: false,
        setupFee: 0,
        images: [
          {
            file: new File([""], "drill1.jpg"),
            url: "https://example.com/drill1.jpg",
            orderIndex: 0,
          },
          {
            file: new File([""], "drill2.jpg"),
            url: "https://example.com/drill2.jpg",
            orderIndex: 1,
          },
        ],
        ownerPoliciesAcknowledged: true,
      };

      const result = createListingSchemaClient.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should apply all server schema validations", () => {
      const data = {
        name: "", // Invalid: empty name
        description: "A drill",
        categoryId: "power-tools",
        condition: "good",
        dailyRate: 15.0,
        images: [
          {
            file: new File([""], "drill.jpg"),
            url: "https://example.com/drill.jpg",
          },
        ],
        ownerPoliciesAcknowledged: true,
      };

      const result = createListingSchemaClient.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Listing name is required");
    });

    it("should apply conditional validations", () => {
      const data = {
        name: "Drill",
        description: "A drill",
        categoryId: "power-tools",
        condition: "good",
        dailyRate: 15.0,
        deliveryMode: "delivery_only",
        deliveryRadius: 0, // Invalid for delivery_only
        setupAvailable: true, // Should be valid with delivery
        images: [
          {
            file: new File([""], "drill.jpg"),
            url: "https://example.com/drill.jpg",
          },
        ],
        ownerPoliciesAcknowledged: true,
      };

      const result = createListingSchemaClient.safeParse(data);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "Delivery radius is required when delivery is available",
      );
    });
  });
});
