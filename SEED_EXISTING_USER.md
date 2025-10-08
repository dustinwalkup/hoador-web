# Seed Data for Existing User

This guide explains how to add seed data to an existing user in your database.

## Overview

The `existing-user.seed.ts` script allows you to populate an existing user's account with:

- ✅ Primary address (if not already exists)
- ✅ User preferences (if not already exists)
- ✅ Sample listings with images
- ✅ Listing categories
- ✅ Availability schedules

## Quick Start

### Method 1: Using Shell Script (Easiest)

```bash
# Look up user by email
./seed-my-account.sh email your-email@example.com

# Look up user by ID
./seed-my-account.sh id user-id-123

# Create custom number of listings
./seed-my-account.sh email your-email@example.com 20
./seed-my-account.sh id user-id-123 15

# Target specific community
./seed-my-account.sh id user-id-123 10 community-id-456
./seed-my-account.sh email your-email@example.com 25 community-xyz
```

### Method 2: Using Environment Variables

```bash
# Look up by email
TARGET_USER_EMAIL="your-email@example.com" bun run seed:user

# Look up by user ID
TARGET_USER_ID="user-id-123" bun run seed:user

# Customize number of listings
TARGET_USER_ID="user-id-123" NUMBER_OF_LISTINGS=20 bun run seed:user

# Target specific community
TARGET_USER_ID="user-id-123" TARGET_COMMUNITY_ID="community-xyz" bun run seed:user

# All options
TARGET_USER_EMAIL="john@example.com" NUMBER_OF_LISTINGS=25 TARGET_COMMUNITY_ID="community-xyz" bun run seed:user
```

### Method 3: Run Directly with tsx

```bash
TARGET_USER_EMAIL="your-email@example.com" tsx src/db/seeds/existing-user.seed.ts
TARGET_USER_ID="user-id-123" tsx src/db/seeds/existing-user.seed.ts
```

## Configuration Options

You can customize the seed using environment variables:

```bash
# Required (one of these):
TARGET_USER_EMAIL="email@example.com"   # Look up user by email
TARGET_USER_ID="user-id-123"            # Look up user by ID

# Optional:
NUMBER_OF_LISTINGS=20                    # Number of listings to create (default: 10)
TARGET_COMMUNITY_ID="community-id-456"   # Specific community for listings (default: user's first community)
```

Examples:

```bash
# Create 20 listings for user by email
TARGET_USER_EMAIL="john@example.com" NUMBER_OF_LISTINGS=20 bun run seed:user

# Create 15 listings for user by ID
TARGET_USER_ID="abc-123" NUMBER_OF_LISTINGS=15 bun run seed:user

# Create listings for a specific community
TARGET_USER_ID="abc-123" TARGET_COMMUNITY_ID="community-xyz" bun run seed:user

# All options combined
TARGET_USER_EMAIL="john@example.com" NUMBER_OF_LISTINGS=25 TARGET_COMMUNITY_ID="community-xyz" bun run seed:user
```

## What Gets Created

### 1. User Address (if missing)

- Randomly generated street address
- City, state, zip code
- Latitude/longitude coordinates
- Set as primary address

### 2. User Preferences (if missing)

- Email, SMS, and push notification settings
- Lending radius (10 miles default)
- Default rental period (5 days)
- Profile visibility settings
- Timezone and language settings

### 3. Listings

Creates the specified number of listings from templates including:

- **Automotive**: Hydraulic floor jack, car tools
- **Party Equipment**: Folding tables, event supplies
- **Gardening**: Lawn mowers, shovels, hedge trimmers
- **Power Tools**: Drills, table saws, pressure washers
- **Ladders**: Extension ladders, step ladders

Each listing includes:

- Name, description, brand
- Category and specifications
- Pricing (per day, week, month)
- Deposit amount
- Condition (new, like new, good, fair)
- Delivery options
- Availability schedule
- Mock ratings and reviews
- Primary image from `/public/images/mock/tools/`

### 4. Categories

Automatically creates any missing categories needed for the listings:

- Automotive
- Party Equipment
- Gardening
- Power Tools
- Ladders
- Cleaning

### 5. Availability

Each listing gets a 30-day availability window starting from today.

## Example Output

```
🌱 Looking up user by email: john@example.com...
✅ Found user: John Doe (john@example.com)
✓ User already has an address
✓ User already has preferences
📦 Creating 10 listings...
✅ Created 2 new categories
✅ Created 10 listings
✅ Created 10 listing images
✅ Created 10 availability entries

🎉 Existing user seed complete!

📊 Summary:
   User: John Doe (john@example.com)
   User ID: abc-123-def-456
   Listings: 10
   Categories: 2 (new)
   Images: 10
   Availability: 10
```

## Error Handling

### No User Identifier Provided

If you don't provide either email or ID:

```
❌ Error: Must provide either TARGET_USER_EMAIL or TARGET_USER_ID

💡 Usage examples:
   TARGET_USER_EMAIL="user@example.com" bun run seed:user
   TARGET_USER_ID="user-id-123" bun run seed:user
   TARGET_USER_ID="user-id-123" NUMBER_OF_LISTINGS=20 bun run seed:user
```

**Solution**: Provide either `TARGET_USER_EMAIL` or `TARGET_USER_ID`.

### User Not in a Community

If the user isn't a member of any community:

```
❌ User is not a member of any community
💡 Tip: Users must be part of a community to have listings.
   You can use Drizzle Studio to add the user to a community:
   bun run db:studio
```

**Solution**:

- Users must belong to a community to create listings
- Add the user to a community using Drizzle Studio
- Or create a community first and add the user to it

### Community Not Found

If you specify a community ID that doesn't exist:

```
❌ Community not found with ID: community-id-123
💡 Tip: Check that the community ID is correct.
```

**Solution**: Verify the community ID is correct using `bun run db:studio`

### User Not Member of Specified Community

If you specify a community the user isn't a member of:

```
❌ User is not a member of community: Community Name
💡 Tip: Add the user to this community first using Drizzle Studio
   bun run db:studio
```

**Solution**: Add the user to the specified community before running the seed

### User Not Found

If the email or ID doesn't exist in the database:

```
❌ User not found with email: your-email@example.com
💡 Tip: Check that the email is correct and the user exists in the database.
```

or

```
❌ User not found with ID: user-id-123
💡 Tip: Check that the user ID is correct and exists in the database.
```

**Solution**:

- Verify the email/ID is correct
- Check the user exists in your database (use `bun run db:studio`)
- Create the user first if they don't exist

### Database Connection Issues

If you get connection errors:

```
❌ Error seeding: [error details]
```

**Solution**: Check your `.env` file has the correct `DATABASE_URL`.

## Customization

### Adding More Listing Templates

Edit the `listingTemplates` array in the seed file:

```typescript
const listingTemplates = [
  {
    image: "your-image.jpg",
    name: "Your Tool Name",
    category: "Your Category",
    description: "Tool description",
    brand: "Brand Name",
    specs: { key: "value" },
  },
  // ... add more templates
];
```

### Changing Default Pricing

Modify the pricing ranges in the listing creation section (around line 167):

```typescript
pricePerDay: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
pricePerWeek: faker.number.float({ min: 20, max: 200, fractionDigits: 2 }),
pricePerMonth: faker.number.float({ min: 50, max: 500, fractionDigits: 2 }),
```

### Using Real Images

1. Add your images to `/public/images/mock/tools/`
2. Update the `mockImages` array with your image filenames
3. Update the `listingTemplates` to reference your images

## Running Multiple Times

The seed is **idempotent** for address and preferences:

- ✅ Won't duplicate address or preferences if they exist
- ⚠️ **Will create new listings** each time you run it
- 💡 Consider deleting old listings before re-seeding if needed

## Cleanup

To remove seeded listings:

```sql
-- Delete listings for a specific user
DELETE FROM listing_images WHERE listing_id IN (
  SELECT id FROM listings WHERE owner_id = 'user-id-here'
);
DELETE FROM listing_availability WHERE listing_id IN (
  SELECT id FROM listings WHERE owner_id = 'user-id-here'
);
DELETE FROM listings WHERE owner_id = 'user-id-here';
```

Or use Drizzle Studio:

```bash
bun run db:studio
```

## Integration with Main Seed

To include this in your main seed flow, edit `src/db/seeds/seed.ts`:

```typescript
const seedFiles = [
  "users.seed.ts",
  "communities.seed.ts",
  "listings.seed.ts",
  "existing-user.seed.ts", // Add this line
  "rentals.seed.ts",
  "payments.seed.ts",
  "notifications.seed.ts",
  "messages.seed.ts",
  "collections.seed.ts",
];
```

## Troubleshooting

### Images Not Showing

- Verify images exist in `/public/images/mock/tools/`
- Check image filenames match exactly (case-sensitive)
- Clear Next.js cache: `rm -rf .next`

### Categories Not Created

The seed will automatically create missing categories. If categories already exist with different IDs, it will use the existing ones.

### Availability Issues

Availability is set for 30 days from the current date. Adjust the date range in the seed file if needed.

## Support

For issues or questions:

1. Check the console output for specific error messages
2. Verify your `.env` file configuration
3. Ensure the target user exists in the database
4. Check that all required images are present

## Related Scripts

- `bun run seed` - Run full database seed (creates new users)
- `bun run db:studio` - Open Drizzle Studio to view/edit data
- `bun run db:push` - Push schema changes to database
