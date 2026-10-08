export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  /** Public https origin of this deployment (SITE_ORIGIN). Used to wire
   *  webhook URLs onto platform-purchased phone lines. Managed business lines
   *  require it to be set explicitly — no silent default, because a wrong
   *  origin would wire a paid number to a dead URL. */
  siteOrigin: process.env.SITE_ORIGIN ?? "",
};
