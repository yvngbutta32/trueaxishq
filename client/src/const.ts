export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Self-contained email/password authentication.
// Always redirects to the local login page.
export const getLoginUrl = (returnPath?: string) => {
  if (returnPath) {
    return `/login?return=${encodeURIComponent(returnPath)}`;
  }
  return "/login";
};
