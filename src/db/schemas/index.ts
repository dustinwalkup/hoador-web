// DO NOT import './_relations' here! Importing relations in the schema index causes circular imports and runtime errors in Drizzle ORM.
// Only import and use './_relations' in your app entrypoint or DAL setup if needed for relation registration.

import * as user from "./user.schema";
import * as communities from "./communities.schema";
import * as listings from "./listings.schema";
import * as rentals from "./rentals.schema";
import * as payments from "./payments.schema";
import * as collections from "./collections.schema";
import * as messages from "./messages.schema";
import * as notifications from "./notifications.schema";

export const schema = {
  ...user,
  ...communities,
  ...listings,
  ...rentals,
  ...payments,
  ...collections,
  ...messages,
  ...notifications,
};
