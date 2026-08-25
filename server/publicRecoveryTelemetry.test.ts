import { describe, expect, it } from "vitest";
import { isExpectedPublicRecoveryPath } from "../shared/publicRecoveryTelemetry";

describe("public recovery telemetry classification", () => {
  it("classifies only the token- and slug-based public recovery routes as expected", () => {
    for (const path of [
      "/book/example-business",
      "/booking/manage/revoked-token",
      "/intake/expired-intake",
      "/portal/expired-token",
      "/proposal/expired-token",
      "/testimonial/expired-token",
    ]) {
      expect(isExpectedPublicRecoveryPath(path)).toBe(true);
    }

    for (const path of ["/", "/dashboard", "/billing", "/admin", "/success", "/book"]) {
      expect(isExpectedPublicRecoveryPath(path)).toBe(false);
    }
  });
});
