export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Self-contained auth — no Manus OAuth dependency.
// Always redirects to the local login page.
export const getLoginUrl = (returnPath?: string) => {
  if (returnPath) {
    return `/login?return=${encodeURIComponent(returnPath)}`;
  }
  return "/login";
};
