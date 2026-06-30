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
import * as legalDocuments from "./legal-documents.schema";
import * as disputes from "./disputes.schema";
import * as rentalAgreementDocuments from "./rental-agreement-documents.schema";
import * as serviceAgreementDocuments from "./service-agreement-documents.schema";
import * as userActivity from "./user-activity.schema";
import * as auditLogs from "./audit-logs.schema";
import * as rentalPaymentLifecycle from "./rental-payment-lifecycle.schema";
import * as cronRunHistory from "./cron-run-history.schema";
import * as services from "./services.schema";
import * as servicePaymentLifecycle from "./service-payment-lifecycle.schema";
import * as reviewEvents from "./review-events.schema";
import * as blindReviews from "./blind-reviews.schema";
import * as neighborhoodNeeds from "./neighborhood-needs.schema";

export const schema = {
  ...user,
  ...communities,
  ...listings,
  ...rentals,
  ...payments,
  ...collections,
  ...messages,
  ...notifications,
  ...legalDocuments,
  ...disputes,
  ...rentalAgreementDocuments,
  ...serviceAgreementDocuments,
  ...userActivity,
  ...auditLogs,
  ...rentalPaymentLifecycle,
  ...cronRunHistory,
  ...services,
  ...servicePaymentLifecycle,
  ...reviewEvents,
  ...blindReviews,
  ...neighborhoodNeeds,
};
