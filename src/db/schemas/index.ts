// DO NOT import './_relations' here! Importing relations in the schema index causes circular imports and runtime errors in Drizzle ORM.
// Only import and use './_relations' in your app entrypoint or DAL setup if needed for relation registration.

import * as users from "./users.schema";
import * as tools from "./tools.schema";
import * as rentals from "./rentals.schema";
import * as payments from "./payments.schema";
import * as collections from "./collections.schema";
import * as messages from "./messages.schema";
import * as notifications from "./notifications.schema";
import * as sessions from "./sessions.schema";

export const schema = {
  ...users,
  ...tools,
  ...rentals,
  ...payments,
  ...collections,
  ...messages,
  ...notifications,
  ...sessions,
};
