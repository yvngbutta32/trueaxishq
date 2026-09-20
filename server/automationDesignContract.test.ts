import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Automation design contract — "effortless, visually clear, confidence-inspiring."
 *
 * Pins the shipped design decisions so the automation experience cannot silently
 * regress back to a wall-of-fields form or a desktop-only layout:
 * - A guided 3-step builder (Trigger → Action → Review) with a visible progress
 *   path, contextual help on every step, and a plain-English summary before save.
 * - Onboarding walks a new user to their FIRST automation, computed from real data.
 * - The mobile experience is first-class: templates CTA never hidden on phones,
 *   footer buttons stack, stat tiles compress.
 */

const routers = readFileSync("server/routers.ts", "utf8");
const checklist = readFileSync("client/src/components/OnboardingChecklist.tsx", "utf8");
const page = readFileSync("client/src/pages/Automations.tsx", "utf8");

describe("guided 3-step automation builder", () => {
  it("breaks the builder into Trigger, Action, and Review steps with a progress indicator", () => {
    expect(page).toContain("const [step, setStep] = useState<1 | 2 | 3>(1)");
    expect(page).toContain('label: "Trigger"');
    expect(page).toContain('label: "Action"');
    expect(page).toContain('label: "Review"');
    expect(page).toContain("Builder step ${step} of 3");
  });

  it("moves forward and back between steps with a single decision per screen", () => {
    expect(page).toContain("Next: {step === 1 ? \"Action\" : \"Review\"}");
    expect(page).toContain("(cur - 1) as 1 | 2 | 3");
    expect(page).toContain("(cur + 1) as 1 | 2 | 3");
  });

  it("shows contextual help on every step — not a silent wall of fields", () => {
    expect(page).toContain("Pick the event that starts this workflow.");
    expect(page).toContain("Actions run in the order shown");
    expect(page).toContain("name it and confirm it reads the way you expect");
  });

  it("reviews in plain English before saving, and cannot save without a name", () => {
    expect(page).toContain("In plain English");
    expect(page).toContain("Give it a name so you can find it later.");
    expect(page).toContain("!form.name.trim()");
  });

  it("resets the wizard to step 1 on every open path (new, starter, edit, reopen)", () => {
    expect((page.match(/setStep\(1\)/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});

describe("effortless onboarding to the first automation", () => {
  it("adds the first-automation step, computed from the owner's real automations table", () => {
    expect(routers).toContain("from(automations).where(eq(automations.userId, uid)).limit(1)");
    expect(routers).toContain("hasAutomation = !!automationRow");
    expect(routers).toContain("automation: hasAutomation");
  });

  it("links the checklist step straight to the Automations panel", () => {
    expect(checklist).toContain('id: "automation"');
    expect(checklist).toContain('panel: "automations"');
    expect(checklist).toContain("it takes about a minute");
  });

  it("gives first-time users a 3-step quick path in the empty state", () => {
    expect(page).toContain("Load a starter template");
    expect(page).toContain("Review the trigger, timing, and message");
    expect(page).toContain("Test it, then flip it on");
  });
});

describe("mobile-first responsiveness and CTAs", () => {
  it("never hides the templates CTA on small screens", () => {
    expect(page).not.toContain("hidden sm:flex");
  });

  it("stacks footer buttons on phones and keeps the primary CTA distinct", () => {
    expect(page).toContain("DialogFooter className=\"flex-col gap-2");
    expect(page).toContain("bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold");
  });

  it("compresses stat tiles on small screens instead of overflowing", () => {
    expect(page).toContain("grid grid-cols-3 gap-2 sm:gap-4");
    expect(page).toContain("rounded-xl p-3 sm:p-4 text-center");
  });
});
