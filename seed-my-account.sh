#!/bin/bash

# Quick script to seed your user account with sample data
# Usage: 
#   ./seed-my-account.sh email your-email@example.com [number_of_listings] [community_id]
#   ./seed-my-account.sh id user-id-123 [number_of_listings] [community_id]

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "❌ Error: Please provide lookup type and value"
  echo ""
  echo "Usage:"
  echo "  ./seed-my-account.sh email your-email@example.com [number_of_listings] [community_id]"
  echo "  ./seed-my-account.sh id user-id-123 [number_of_listings] [community_id]"
  echo ""
  echo "Examples:"
  echo "  ./seed-my-account.sh email john@example.com"
  echo "  ./seed-my-account.sh email john@example.com 20"
  echo "  ./seed-my-account.sh id abc-123-def 15"
  echo "  ./seed-my-account.sh id abc-123-def 15 community-xyz-789"
  exit 1
fi

LOOKUP_TYPE=$1
LOOKUP_VALUE=$2
NUM_LISTINGS=${3:-10}
COMMUNITY_ID=${4:-""}

ENV_VARS="NUMBER_OF_LISTINGS=$NUM_LISTINGS"

if [ -n "$COMMUNITY_ID" ]; then
  ENV_VARS="$ENV_VARS TARGET_COMMUNITY_ID=$COMMUNITY_ID"
  echo "🎯 Targeting community: $COMMUNITY_ID"
fi

if [ "$LOOKUP_TYPE" = "email" ]; then
  echo "🌱 Seeding account for email: $LOOKUP_VALUE (creating $NUM_LISTINGS listings)"
  env TARGET_USER_EMAIL="$LOOKUP_VALUE" $ENV_VARS bun run seed:user
elif [ "$LOOKUP_TYPE" = "id" ]; then
  echo "🌱 Seeding account for user ID: $LOOKUP_VALUE (creating $NUM_LISTINGS listings)"
  env TARGET_USER_ID="$LOOKUP_VALUE" $ENV_VARS bun run seed:user
else
  echo "❌ Error: Invalid lookup type '$LOOKUP_TYPE'. Use 'email' or 'id'"
  exit 1
fi

