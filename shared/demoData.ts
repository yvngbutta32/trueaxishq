/**
 * Demo-data markers — the single source of truth for identifying seeded
 * sample rows. Everything the sample-data feature inserts carries these
 * prefixes, and the one-click removal deletes exactly the prefixed rows:
 * real owner data can never be touched by either side of the feature.
 *
 * The first-hour onboarding guarantee also excludes prefixed rows from its
 * progress counts, so exploring with sample data never fakes "operational".
 */
export const DEMO_CLIENT_PREFIX = "Sample — ";
export const DEMO_INVOICE_PREFIX = "SAMPLE-";
export const DEMO_JOB_PREFIX = "SAMPLE-JOB-";
