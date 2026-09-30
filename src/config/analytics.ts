/**
 * Analytics identifiers shared by server and client code.
 *
 * The measurement ID is not a secret, and NEXT_PUBLIC_* values are inlined at
 * build time, so the default is committed here to keep the ID in one place.
 */
export const gaMeasurementId =
  process.env.NEXT_PUBLIC_GA_ID ?? '';
