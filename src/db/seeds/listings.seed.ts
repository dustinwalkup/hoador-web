import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db";
import {
  listings,
  listingCategories,
  listingAvailability,
  listingImages,
} from "../schemas/listings.schema";
import { users } from "../schemas/users.schema";
import { communityMemberships } from "../schemas/communities.schema";

// Infer types
type NewListing = InferInsertModel<typeof listings>;
type NewCategory = InferInsertModel<typeof listingCategories>;
type NewAvailability = InferInsertModel<typeof listingAvailability>;
type NewListingImage = InferInsertModel<typeof listingImages>;

// Available mock images in public/images/mock/tools/
const mockImages = [
  "car-jack.jpg",
  "Table-Rental.jpg",
  "lawn-mower2.jpg",
  "shovel.jpg",
  "wheelbarrow.jpg",
  "leaf blower.avif",
  "weed-wacker.webp",
  "garden-hoe.jpg",
  "post-hole-digger.jpg",
  "rake.webp",
  "table-saw.jpg",
  "screw drivers.jpeg",
  "pressure-washer.jpg",
  "skill-saw.jpg",
  "ladder.jpg",
  "drill-set.jpg",
  "lawn-mower.jpg",
  "hedge-trimmer.jpg",
  "trailer-hitch.jpg",
  "garden-tools.jpg",
  "cordless-drill.jpg",
  "miter-saw.jpg",
  "tools-pegboard.jpg",
  "tool-bench.jpg",
  "garage-stock.png",
  // New images
  "party-tables.webp",
  "party-tables2.jpg",
  "catering-warmers.jpg",
  "party-tent.jpg",
  "bounce-house.avif",
  "cocktail table.jpg",
  "automotive-wrenches.jpg",
  "tire-lug-gun.webp",
  "car-wrench.jpg",
  "automotive-stool.webp",
  "tire-air-compressor.webp",
  "floor-waxer.webp",
  "vacuum.jpg",
  "cleaning-brush.jpg",
  "carpet-cleaner.png",
  "tape-measure.jpg",
  "level-tool.webp",
  "hand-saw.jpeg",
  "step-ladder.webp",
  "tall ladder.webp",
  "really-tall-ladder.jpg",
];

// listing templates based on available images
const listingTemplates = [
  {
    image: "car-jack.jpg",
    name: "Hydraulic Floor Jack",
    category: "Automotive",
    description: "Heavy-duty hydraulic floor jack for lifting vehicles safely",
    brand: "Torin",
    specs: { weight: 75, maxLift: "3 tons" },
  },
  {
    image: "Table-Rental.jpg",
    name: "Folding Event Table",
    category: "Party Equipment",
    description: "8ft folding table perfect for events and gatherings",
    brand: "Lifetime",
    specs: { length: 96, width: 30, material: "high-density polyethylene" },
  },
  {
    image: "lawn-mower2.jpg",
    name: "Self-Propelled Lawn Mower",
    category: "Gardening",
    description: "Gas-powered self-propelled mower with mulching capability",
    brand: "Honda",
    specs: { engineSize: "190cc", cuttingWidth: 21, fuelType: "gasoline" },
  },
  {
    image: "shovel.jpg",
    name: "Round Point Shovel",
    category: "Gardening",
    description: "Heavy-duty round point shovel for digging and planting",
    brand: "Fiskars",
    specs: {
      handleLength: 48,
      headMaterial: "tempered steel",
      handleMaterial: "fiberglass",
    },
  },
  {
    image: "wheelbarrow.jpg",
    name: "Steel Wheelbarrow",
    category: "Gardening",
    description: "6 cubic foot steel wheelbarrow with pneumatic tire",
    brand: "True Temper",
    specs: {
      capacity: "6 cu ft",
      wheelType: "pneumatic",
      material: "heavy-gauge steel",
    },
  },
  {
    image: "leaf blower.avif",
    name: "Electric Leaf Blower",
    category: "Gardening",
    description: "Corded electric leaf blower for yard cleanup",
    brand: "Black+Decker",
    specs: { airSpeed: "250 mph", powerSource: "corded electric", weight: 4.4 },
  },
  {
    image: "weed-wacker.webp",
    name: "String Trimmer",
    category: "Gardening",
    description: "Gas-powered string trimmer for lawn edging",
    brand: "Echo",
    specs: { engineSize: "25.4cc", cuttingWidth: 17, lineType: "dual line" },
  },
  {
    image: "garden-hoe.jpg",
    name: "Garden Hoe",
    category: "Gardening",
    description: "Traditional garden hoe for weeding and cultivation",
    brand: "Corona",
    specs: { bladeWidth: 7, handleLength: 54, material: "carbon steel" },
  },
  {
    image: "post-hole-digger.jpg",
    name: "Post Hole Digger",
    category: "Gardening",
    description: "Manual post hole digger for fence installation",
    brand: "Seymour",
    specs: { digDepth: 48, bladeLength: 8, handleMaterial: "hardwood" },
  },
  {
    image: "rake.webp",
    name: "Bow Rake",
    category: "Gardening",
    description: "Heavy-duty bow rake for soil preparation",
    brand: "Ames",
    specs: { tineCount: 16, handleLength: 60, tineLength: 2.75 },
  },
  {
    image: "table-saw.jpg",
    name: "Contractor Table Saw",
    category: "Power Tools",
    description: "10-inch contractor table saw with stand",
    brand: "DeWalt",
    specs: { bladeSize: 10, rippingCapacity: 32.5, motorPower: "15 amp" },
  },
  {
    image: "screw drivers.jpeg",
    name: "Screwdriver Set",
    category: "Hand Tools",
    description: "Complete set of Phillips and flathead screwdrivers",
    brand: "Klein Tools",
    specs: {
      pieceCount: 12,
      tipTypes: ["Phillips", "flathead"],
      handleType: "cushion grip",
    },
  },
  {
    image: "pressure-washer.jpg",
    name: "Electric Pressure Washer",
    category: "Cleaning",
    description: "1800 PSI electric pressure washer for cleaning",
    brand: "Sun Joe",
    specs: { pressure: "1800 PSI", flow: "1.2 GPM", powerSource: "electric" },
  },
  {
    image: "skill-saw.jpg",
    name: "Circular Saw",
    category: "Power Tools",
    description: "7.25-inch circular saw for cutting lumber",
    brand: "Skilsaw",
    specs: { bladeSize: 7.25, motorPower: "15 amp", maxDepth: 2.5 },
  },
  {
    image: "ladder.jpg",
    name: "Extension Ladder",
    category: "Ladders & Access",
    description: "24-foot aluminum extension ladder",
    brand: "Werner",
    specs: { height: 24, material: "aluminum", weight: 44, maxWeight: 250 },
  },
  {
    image: "drill-set.jpg",
    name: "Drill Bit Set",
    category: "Hand Tools",
    description: "Complete set of high-speed steel drill bits",
    brand: "Bosch",
    specs: {
      pieceCount: 29,
      material: "high-speed steel",
      sizes: "1/16 to 1/2 inch",
    },
  },
  {
    image: "lawn-mower.jpg",
    name: "Push Lawn Mower",
    category: "Gardening",
    description: "Gas-powered push mower with side discharge",
    brand: "Craftsman",
    specs: { engineSize: "140cc", cuttingWidth: 21, startType: "recoil" },
  },
  {
    image: "hedge-trimmer.jpg",
    name: "Electric Hedge Trimmer",
    category: "Gardening",
    description: "Corded electric hedge trimmer for landscaping",
    brand: "Black+Decker",
    specs: { bladeLength: 22, powerSource: "corded electric", weight: 5.5 },
  },
  {
    image: "trailer-hitch.jpg",
    name: "Trailer Hitch",
    category: "Automotive",
    description: "Class III trailer hitch for towing",
    brand: "Curt",
    specs: {
      towingCapacity: "5000 lbs",
      tongueWeight: "500 lbs",
      class: "III",
    },
  },
  {
    image: "garden-tools.jpg",
    name: "Garden Tool Set",
    category: "Gardening",
    description: "3-piece garden tool set with hand tools",
    brand: "Fiskars",
    specs: {
      pieceCount: 3,
      includes: ["trowel", "weeder", "cultivator"],
      handleType: "ergonomic",
    },
  },
  {
    image: "cordless-drill.jpg",
    name: "Cordless Drill",
    category: "Power Tools",
    description: "18V cordless drill/driver with battery",
    brand: "Ryobi",
    specs: { voltage: 18, chuckSize: 0.5, batteryType: "lithium-ion" },
  },
  {
    image: "miter-saw.jpg",
    name: "Compound Miter Saw",
    category: "Power Tools",
    description: "10-inch compound miter saw for precision cuts",
    brand: "Makita",
    specs: { bladeSize: 10, maxCrosscut: 5.5, motorPower: "15 amp" },
  },
  {
    image: "tools-pegboard.jpg",
    name: "Tool Organization System",
    category: "Construction",
    description: "Complete pegboard tool organization system",
    brand: "StoreWALL",
    specs: {
      boardSize: "48x32",
      material: "heavy-duty steel",
      hooks: "included",
    },
  },
  {
    image: "tool-bench.jpg",
    name: "Workbench",
    category: "Construction",
    description: "Heavy-duty workbench with storage",
    brand: "Keter",
    specs: {
      length: 48,
      height: 33,
      material: "hardwood top",
      storage: "drawers and shelves",
    },
  },
  {
    image: "garage-stock.png",
    name: "Tool Storage Cabinet",
    category: "Construction",
    description: "Steel tool storage cabinet with multiple drawers",
    brand: "Craftsman",
    specs: { drawers: 8, material: "heavy-gauge steel", lockable: true },
  },
  // New tool templates
  {
    image: "party-tables.webp",
    name: "Round Party Tables",
    category: "Party Equipment",
    description: "60-inch round tables perfect for events and weddings",
    brand: "Lifetime Commercial",
    specs: { diameter: 60, seats: 8, material: "blow-molded plastic" },
  },
  {
    image: "party-tables2.jpg",
    name: "Rectangular Banquet Tables",
    category: "Party Equipment",
    description: "8-foot rectangular banquet tables for large events",
    brand: "National Public Seating",
    specs: { length: 96, width: 30, seats: 8, foldable: true },
  },
  {
    image: "catering-warmers.jpg",
    name: "Chafing Dish Set",
    category: "Party Equipment",
    description: "Stainless steel chafing dishes for catering events",
    brand: "Tiger Chef",
    specs: { capacity: "8 quart", pieces: 4, fuelType: "sterno" },
  },
  {
    image: "party-tent.jpg",
    name: "Event Tent",
    category: "Party Equipment",
    description: "20x30 frame tent for outdoor events",
    brand: "Eurmax",
    specs: { size: "20x30 ft", capacity: 120, material: "heavy-duty vinyl" },
  },
  {
    image: "bounce-house.avif",
    name: "Inflatable Bounce House",
    category: "Party Equipment",
    description: "Commercial grade bounce house for kids parties",
    brand: "Blast Zone",
    specs: { size: "15x15 ft", capacity: 8, ageRange: "3-12 years" },
  },
  {
    image: "cocktail table.jpg",
    name: "Cocktail Table",
    category: "Party Equipment",
    description: "High-top cocktail table for standing events",
    brand: "Flash Furniture",
    specs: { height: 42, diameter: 30, material: "wood top" },
  },
  {
    image: "automotive-wrenches.jpg",
    name: "Wrench Set",
    category: "Automotive",
    description: "Complete SAE and metric wrench set",
    brand: "Craftsman",
    specs: {
      pieces: 22,
      sizes: "8mm-19mm, 5/16-3/4",
      material: "chrome vanadium",
    },
  },
  {
    image: "tire-lug-gun.webp",
    name: "Impact Wrench",
    category: "Automotive",
    description: "Pneumatic impact wrench for tire changes",
    brand: "Ingersoll Rand",
    specs: {
      torque: "600 ft-lbs",
      driveSize: "1/2 inch",
      airPressure: "90 PSI",
    },
  },
  {
    image: "car-wrench.jpg",
    name: "Combination Wrench",
    category: "Automotive",
    description: "Heavy-duty combination wrench for automotive repair",
    brand: "Snap-on",
    specs: { size: "3/4 inch", length: 10, finish: "chrome" },
  },
  {
    image: "automotive-stool.webp",
    name: "Mechanic's Stool",
    category: "Automotive",
    description: "Rolling stool with tool tray for garage work",
    brand: "Torin Big Red",
    specs: { height: "adjustable", capacity: "300 lbs", wheels: 5 },
  },
  {
    image: "tire-air-compressor.webp",
    name: "Portable Air Compressor",
    category: "Automotive",
    description: "12V portable air compressor for tires",
    brand: "VIAIR",
    specs: { maxPSI: 150, flowRate: "2.30 CFM", powerSource: "12V DC" },
  },
  {
    image: "floor-waxer.webp",
    name: "Floor Buffer",
    category: "Cleaning",
    description: "Commercial floor buffer for polishing and cleaning",
    brand: "Oreck",
    specs: { padSize: 17, motorPower: "1.5 HP", speed: "175 RPM" },
  },
  {
    image: "vacuum.jpg",
    name: "Shop Vacuum",
    category: "Cleaning",
    description: "Wet/dry shop vacuum for heavy-duty cleaning",
    brand: "Shop-Vac",
    specs: { capacity: "16 gallons", horsepower: 6.5, hoseLength: 10 },
  },
  {
    image: "cleaning-brush.jpg",
    name: "Scrub Brush Set",
    category: "Cleaning",
    description: "Heavy-duty scrub brushes for cleaning",
    brand: "Libman",
    specs: { pieces: 3, bristleType: "synthetic", handleLength: 9 },
  },
  {
    image: "carpet-cleaner.png",
    name: "Carpet Cleaner",
    category: "Cleaning",
    description: "Professional carpet cleaning machine",
    brand: "Bissell",
    specs: { tankCapacity: "1.75 gallons", heatingSystem: true, hoseLength: 9 },
  },
  {
    image: "tape-measure.jpg",
    name: "Measuring Tape",
    category: "Hand Tools",
    description: "Heavy-duty measuring tape for construction",
    brand: "Stanley",
    specs: { length: 25, width: 1.25, standout: 11, caseType: "magnetic" },
  },
  {
    image: "level-tool.webp",
    name: "Spirit Level",
    category: "Hand Tools",
    description: "Professional aluminum spirit level",
    brand: "Stabila",
    specs: { length: 48, vials: 3, accuracy: "0.5mm/m", material: "aluminum" },
  },
  {
    image: "hand-saw.jpeg",
    name: "Hand Saw",
    category: "Hand Tools",
    description: "Traditional hand saw for woodworking",
    brand: "Disston",
    specs: { length: 26, teethPerInch: 8, handleType: "hardwood" },
  },
  {
    image: "step-ladder.webp",
    name: "Step Ladder",
    category: "Ladders & Access",
    description: "6-foot aluminum step ladder",
    brand: "Louisville Ladder",
    specs: { height: 6, steps: 5, maxWeight: 250, material: "aluminum" },
  },
  {
    image: "tall ladder.webp",
    name: "Tall Step Ladder",
    category: "Ladders & Access",
    description: "10-foot fiberglass step ladder",
    brand: "Werner",
    specs: { height: 10, steps: 9, maxWeight: 300, material: "fiberglass" },
  },
  {
    image: "really-tall-ladder.jpg",
    name: "Professional Extension Ladder",
    category: "Ladders & Access",
    description: "32-foot professional extension ladder",
    brand: "Little Giant",
    specs: {
      maxHeight: 32,
      collapsed: 16,
      maxWeight: 375,
      material: "aluminum",
    },
  },
];

// Define status distribution for realistic garage representation
const statusDistribution = [
  // Active listings (75% of all listings)
  { status: "available", isActive: true, weight: 50 }, // 50% available
  { status: "rented", isActive: true, weight: 25 }, // 25% rented

  // Inactive listings (15% of all listings)
  { status: "maintenance", isActive: true, weight: 8 }, // 8% in maintenance
  { status: "inactive", isActive: true, weight: 7 }, // 7% inactive

  // Archived listings (10% of all listings)
  { status: "available", isActive: false, weight: 5 }, // 5% archived but available status
  { status: "inactive", isActive: false, weight: 5 }, // 5% archived and inactive status
];

function getRandomStatusAndActive() {
  const totalWeight = statusDistribution.reduce(
    (sum, item) => sum + item.weight,
    0,
  );
  const randomNum = faker.number.int({ min: 1, max: totalWeight });

  let currentWeight = 0;
  for (const item of statusDistribution) {
    currentWeight += item.weight;
    if (randomNum <= currentWeight) {
      return { status: item.status, isActive: item.isActive };
    }
  }

  // Fallback
  return { status: "available", isActive: true };
}

async function main() {
  console.log("🌱 Seeding listings and availability with all statuses...");

  // Clear existing data
  await db.delete(listingImages);
  await db.delete(listingAvailability);
  await db.delete(listings);
  await db.delete(listingCategories);

  const allUsers = await db.select().from(users);

  if (allUsers.length === 0) {
    throw new Error("No users found. Run user seed first.");
  }

  // Get all community memberships to assign listings to the correct communities
  const allMemberships = await db
    .select({
      userId: communityMemberships.userId,
      communityId: communityMemberships.communityId,
    })
    .from(communityMemberships);

  if (allMemberships.length === 0) {
    throw new Error(
      "No community memberships found. Run communities seed first.",
    );
  }

  // Create a map of userId to communityId for quick lookup
  const userCommunityMap = new Map<string, string>();
  allMemberships.forEach((membership) => {
    userCommunityMap.set(membership.userId, membership.communityId);
  });

  const categories: NewCategory[] = [
    {
      id: faker.string.uuid(),
      name: "Power Tools",
      description:
        "Electric and battery-powered tools for construction and woodworking",
      icon: "drill",
      parentId: null,
      sortOrder: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Hand Tools",
      description: "Non-powered hand tools for various tasks",
      icon: "wrench",
      parentId: null,
      sortOrder: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Gardening",
      description: "Yard maintenance and gardening equipment",
      icon: "shovel",
      parentId: null,
      sortOrder: 3,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Ladders & Access",
      description: "Ladders, scaffolding, and access equipment",
      icon: "ladder",
      parentId: null,
      sortOrder: 4,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Construction",
      description: "Heavy-duty construction and building tools",
      icon: "hammer",
      parentId: null,
      sortOrder: 5,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Cleaning",
      description: "Pressure washers and cleaning equipment",
      icon: "vacuum",
      parentId: null,
      sortOrder: 6,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Automotive",
      description: "Car repair and maintenance tools",
      icon: "jack",
      parentId: null,
      sortOrder: 7,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Party Equipment",
      description: "Tables, tents, and event equipment",
      icon: "tent",
      parentId: null,
      sortOrder: 8,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await db.insert(listingCategories).values(categories);

  const seedListings: NewListing[] = [];
  const seedAvailability: NewAvailability[] = [];
  const seedImages: NewListingImage[] = [];

  // Helper function to find category by name
  const findCategory = (name: string) =>
    categories.find((c) => c.name === name);

  // Generate 350 listings with variety across all statuses
  const totalListings = 350;
  console.log(
    `📦 Generating ${totalListings} listings with realistic status distribution...`,
  );

  for (let i = 0; i < totalListings; i++) {
    const owner = faker.helpers.arrayElement(allUsers);
    const ownerCommunityId = userCommunityMap.get(owner.id);

    if (!ownerCommunityId) {
      throw new Error(`Owner ${owner.id} is not a member of any community`);
    }
    const template = faker.helpers.arrayElement(listingTemplates);
    const category =
      findCategory(template.category) || faker.helpers.arrayElement(categories);
    const listingId = faker.string.uuid();

    if (!category || !category.id) {
      throw new Error("Failed to get a valid category");
    }

    // Get random status and active state based on distribution
    const { status, isActive } = getRandomStatusAndActive();

    // Create variations of the template
    const nameVariations = [
      template.name,
      `Professional ${template.name}`,
      `Heavy Duty ${template.name}`,
      `Commercial ${template.name}`,
      `Deluxe ${template.name}`,
      `Compact ${template.name}`,
    ];

    const listing: NewListing = {
      id: listingId,
      ownerId: owner.id,
      communityId: ownerCommunityId,
      categoryId: category.id,
      name: faker.helpers.arrayElement(nameVariations),
      description: template.description + ". " + faker.lorem.sentence(),
      brand: template.brand,
      model: faker.string
        .alphanumeric({ length: { min: 6, max: 10 } })
        .toUpperCase(),
      condition: faker.helpers.arrayElement([
        "excellent",
        "good",
        "fair",
        "poor",
      ]),
      dailyRate: faker.number
        .float({ min: 15, max: 150, multipleOf: 5 })
        .toString(),
      weeklyRate: faker.datatype.boolean()
        ? faker.number.float({ min: 75, max: 750, multipleOf: 25 }).toString()
        : null,
      monthlyRate: faker.datatype.boolean()
        ? faker.number.float({ min: 250, max: 2000, multipleOf: 50 }).toString()
        : null,
      securityDeposit: faker.number
        .float({ min: 25, max: 300, multipleOf: 25 })
        .toString(),
      status: status as "available" | "rented" | "maintenance" | "inactive",
      specifications: {
        ...Object.fromEntries(
          Object.entries(template.specs).filter(
            ([, value]) => value !== undefined,
          ),
        ),
        weight: faker.number.float({ min: 2, max: 50, multipleOf: 0.5 }),
        serialNumber: faker.string.alphanumeric(10).toUpperCase(),
      },
      instructions: `Please inspect the ${template.name.toLowerCase()} before use. ${faker.lorem.sentences(2)}`,
      safetyNotes: `Always wear appropriate safety gear when using this ${template.name.toLowerCase()}. ${faker.lorem.sentence()}`,
      minimumRentalPeriod: faker.helpers.arrayElement([1, 2, 3]),
      maximumRentalPeriod: faker.number.int({ min: 7, max: 60 }),
      requiresPickup: faker.datatype.boolean(),
      deliveryAvailable: faker.datatype.boolean(),
      deliveryFee: faker.number
        .float({ min: 0, max: 35, multipleOf: 5 })
        .toString(),
      deliveryRadius: faker.number.int({ min: 0, max: 15 }),
      isActive: isActive,
      viewCount: faker.number.int({ min: 0, max: 250 }),
      favoriteCount: faker.number.int({ min: 0, max: 35 }),
      createdAt: faker.date.past({ years: 2 }),
      updatedAt: new Date(),
    };

    // Create listing image entry using public URL
    const imageId = faker.string.uuid();
    const imageUrl = `/images/mock/tools/${template.image}`;

    seedImages.push({
      id: imageId,
      listingId,
      imageUrl,
      blobPathname: `mock/${template.image}`, // Not a real blob path, but needed for schema
      orderIndex: 0,
      createdAt: new Date(),
    });

    // Sometimes add a second image (random from available)
    if (faker.datatype.boolean() && faker.number.float() > 0.7) {
      const secondImage = faker.helpers.arrayElement(mockImages);
      seedImages.push({
        id: faker.string.uuid(),
        listingId,
        imageUrl: `/images/mock/tools/${secondImage}`,
        blobPathname: `mock/${secondImage}`,
        orderIndex: 1,
        createdAt: new Date(),
      });
    }

    // Create availability entries only for active listings
    if (isActive && (status === "available" || status === "rented")) {
      const availabilityCount = faker.number.int({ min: 1, max: 4 });
      for (let j = 0; j < availabilityCount; j++) {
        const start = faker.date.soon({ days: 60 });
        const end = faker.date.soon({
          days: faker.number.int({ min: 1, max: 14 }),
          refDate: start,
        });

        seedAvailability.push({
          id: faker.string.uuid(),
          listingId,
          startDate: start,
          endDate: end,
          isBlocked: faker.helpers.weightedArrayElement([
            { weight: 80, value: false },
            { weight: 20, value: true },
          ]),
          reason: faker.datatype.boolean()
            ? faker.helpers.arrayElement([
                "maintenance",
                "personal use",
                "booked",
                "inspection",
              ])
            : null,
          createdAt: new Date(),
        });
      }
    }

    seedListings.push(listing);
  }

  console.log(`📦 Inserting ${seedListings.length} listings...`);
  await db.insert(listings).values(seedListings);

  console.log(`🖼️ Inserting ${seedImages.length} listing images...`);
  await db.insert(listingImages).values(seedImages);

  console.log(
    `📅 Inserting ${seedAvailability.length} availability entries...`,
  );
  await db.insert(listingAvailability).values(seedAvailability);

  // Log status distribution for verification
  const statusCounts = {
    active: {
      available: seedListings.filter(
        (t) => t.status === "available" && t.isActive,
      ).length,
      rented: seedListings.filter((t) => t.status === "rented" && t.isActive)
        .length,
    },
    inactive: {
      maintenance: seedListings.filter(
        (t) => t.status === "maintenance" && t.isActive,
      ).length,
      inactive: seedListings.filter(
        (t) => t.status === "inactive" && t.isActive,
      ).length,
    },
    archived: seedListings.filter((t) => !t.isActive).length,
  };

  console.log("✅ listing and availability seed complete");
  console.log(
    `📊 Generated ${seedListings.length} listings with ${seedImages.length} images across ${categories.length} categories`,
  );
  console.log(
    `🎯 Using ${listingTemplates.length} different listing templates with actual mock images`,
  );
  console.log("\n📈 Status Distribution:");
  console.log(
    `   Active listings (${statusCounts.active.available + statusCounts.active.rented}):`,
  );
  console.log(`     - Available: ${statusCounts.active.available}`);
  console.log(`     - Rented: ${statusCounts.active.rented}`);
  console.log(
    `   Inactive listings (${statusCounts.inactive.maintenance + statusCounts.inactive.inactive}):`,
  );
  console.log(`     - Maintenance: ${statusCounts.inactive.maintenance}`);
  console.log(`     - Inactive: ${statusCounts.inactive.inactive}`);
  console.log(`   Archived listings: ${statusCounts.archived}`);
}

main().catch((err) => {
  console.error("❌ Error seeding listings:", err);
  process.exit(1);
});
