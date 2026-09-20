import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Live "on my way" tracking — UI layer contract.
 *
 * Pinned alongside the server core (trackLink.test.ts). The customer page,
 * dispatch board share control, and field-side position sharing must keep the
 * consent-first boundary: the owner starts the link, the staff device opts in,
 * the customer sees position only. No API keys, no third-party map SDKs, no
 * address/contact data on the public page.
 */

const routers = readFileSync("server/routers.ts", "utf8");
const trackPage = readFileSync("client/src/pages/TrackVisit.tsx", "utf8");
const dispatchBoard = readFileSync("client/src/pages/DispatchBoard.tsx", "utf8");
const staffWorkspace = readFileSync("client/src/pages/StaffWorkspace.tsx", "utf8");
const appRoutes = readFileSync("client/src/App.tsx", "utf8");

const staffAccess = routers.slice(routers.indexOf("staffAccess: router({"), routers.indexOf("reportVisitPosition", routers.indexOf("staffAccess: router({")) + 4000);
const reportProc = staffAccess.slice(staffAccess.indexOf("reportVisitPosition"), staffAccess.indexOf("updateAssignmentStatus"));

describe("customer tracking page (/track/:token)", () => {
  it("is routed as a public token-gated page", () => {
    expect(appRoutes).toContain('path="/track/:token"');
    expect(trackPage).toContain('useParams<{ token: string }>()');
  });

  it("reads only the public track endpoint — no client, address, or contact fields exist on the page", () => {
    expect(trackPage).toContain("/api/track/${token}");
    for (const banned of ["clientName", "streetAddress", "clientPhone", "clientEmail", "teamMemberName", "dispatchNote", "clientUpdate", "siteLabel"]) {
      expect(trackPage).not.toContain(banned);
    }
  });

  it("uses a keyless OpenStreetMap embed — no map API keys or third-party SDKs", () => {
    expect(trackPage).toContain("https://www.openstreetmap.org/export/embed.html");
    expect(trackPage).not.toContain("google.com/maps");
    expect(trackPage).not.toContain("mapbox");
    for (const banned of ["API_KEY", "apiKey", "accessToken"]) {
      expect(trackPage).not.toContain(banned);
    }
  });

  it("stops polling the moment the visit is no longer en route (mirrors server auto-revoke)", () => {
    expect(trackPage).toContain('json.data.status !== "en_route"');
    expect(trackPage).toContain("stopPolling()");
  });

  it("renders an honest expired-link state and never guesses arrival", () => {
    expect(trackPage).toContain("This link is no longer active");
    expect(trackPage).toContain("They have arrived");
    expect(trackPage).toContain("expire automatically");
  });
});

describe("dispatch board share control", () => {
  it("starts and stops tracking per visit via the owner-only router", () => {
    expect(dispatchBoard).toContain("trpc.tracking.start.useMutation");
    expect(dispatchBoard).toContain("trpc.tracking.stop.useMutation");
    expect(dispatchBoard).toContain("startTracking.mutate({ visitId: visit.id })");
    expect(dispatchBoard).toContain("stopTracking.mutate({ visitId: visit.id })");
  });

  it("copies the tokenized link on start and explains the auto-end behavior", () => {
    expect(dispatchBoard).toContain("navigator.clipboard.writeText(`${window.location.origin}${d.trackUrl}`)");
    expect(dispatchBoard).toContain("ends automatically when the visit arrives");
  });

  it("only offers the share button while a visit is scheduled or en route", () => {
    expect(dispatchBoard).toContain('(visit.status === "scheduled" || visit.status === "en_route")');
  });

  it("states the consent boundary honestly instead of claiming no location data ever", () => {
    expect(dispatchBoard).toContain("live location appears only when you explicitly start a tracking link");
    expect(dispatchBoard).toContain("Consent-based tracking only — never automatic");
    // The old absolute claim must be gone now that explicit sharing exists.
    expect(dispatchBoard).not.toContain("never exposes staffing, live location, routing, or ETA data");
    expect(dispatchBoard).not.toContain("No GPS, routing, or automated ETA claims");
  });

  it("surfaces per-visit tracking state from the dispatch payload, not client guesses", () => {
    expect(routers).toContain("trackingActive");
    expect(routers).toContain("trackingUrl: trackingActive ?");
  });
});

describe("field-side position sharing (staff workspace)", () => {
  it("rejects positions without an owner-started active link (fail closed)", () => {
    expect(reportProc).toContain("The owner has not started live tracking for this visit.");
    expect(reportProc).toContain("eq(serviceVisitTrackLinks.active, true)");
    expect(reportProc).toContain("visit.status !== \"en_route\"");
    // membership-scoped: only the assigned staff member can report
    expect(reportProc).toContain("visit.teamMemberId !== membership.teamMemberId");
  });

  it("shows the opt-in only for en-route visits the owner is actively tracking", () => {
    expect(staffWorkspace).toContain('visit.status === "en_route" && visit.trackingActive');
    expect(staffWorkspace).toContain("Share my live position");
    expect(staffWorkspace).toContain("Stop sharing my position");
  });

  it("throttles position reports and cleans up watchers on stop and unmount", () => {
    expect(staffWorkspace).toContain("45_000");
    expect(staffWorkspace).toContain("navigator.geolocation.clearWatch");
    expect(staffWorkspace).toContain("watchersRef.current.forEach");
  });

  it("states the consent boundary honestly — the old absolute no-GPS claim is gone", () => {
    expect(staffWorkspace).toContain("Sharing is optional and consent-based");
    expect(staffWorkspace).toContain("shared only when you opt in");
    expect(staffWorkspace).not.toContain("no client-contact, financial, GPS, routing, or private dispatch access");
  });
});
