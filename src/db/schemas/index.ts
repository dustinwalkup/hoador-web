import * as users from "./users";
import * as tools from "./tools";
import * as rentals from "./rentals";
import * as payments from "./payments";
import * as collections from "./collections";
import * as messages from "./messages";
import * as notifications from "./notifications";
import * as sessions from "./sessions";

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
