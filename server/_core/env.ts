export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiBaseUrl: (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, ""),
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  ownerEmail: process.env.OWNER_EMAIL ?? process.env.SMTP_USER ?? "",
  siteOrigin: (process.env.SITE_ORIGIN ?? "http://localhost:3000").replace(/\/+$/, ""),
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  dataApiBaseUrl: process.env.DATA_API_BASE_URL ?? "",
  dataApiKey: process.env.DATA_API_KEY ?? "",
};
