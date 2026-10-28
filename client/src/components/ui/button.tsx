import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * TrueAxis HQ — Unified Button System
 *
 * Hierarchy:
 *   primary   → navy bg, white text  — main CTA, one per section
 *   yellow    → yellow bg, dark text — high-energy CTA (landing page hero)
 *   danger    → red bg, white text   — destructive actions
 *   outline   → white bg, navy border/text — secondary actions on white/light bg
 *   ghost     → transparent, gray text — tertiary actions, icon buttons on white/light bg
 *   link      → underline text link
 *
 * Sizes:
 *   default (h-10) → standard form buttons
 *   sm      (h-8)  → compact inline actions
 *   lg      (h-12) → hero / marketing CTAs
 *   icon    (40px) → square icon-only buttons
 *   icon-sm (32px) → small icon-only buttons
 *   icon-lg (44px) → large icon-only buttons
 *
 * Note: disabled:opacity-50 is intentionally kept — use aria-busy / data-loading
 * for loading states where you don't want opacity reduction.
 */
const buttonVariants = cva(
  // Base — shared across all variants. Drafting-table form language: crisp
  // corners, single hairline borders, a mechanical press instead of the
  // floating-shadow hover dance every SaaS template ships.
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md",
    "text-sm font-semibold transition-colors duration-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  ].join(" "),
  {
    variants: {
      variant: {
        // ── Primary: ink-navy background, paper text — the one action ────
        default:
          "bg-[#1B2D4F] text-white border border-[#1B2D4F] shadow-xs " +
          "hover:bg-[#16233c] hover:border-[#16233c] " +
          "active:translate-y-px active:shadow-none",

        // ── Amber: brand gold, near-black text — high-energy CTA ──────────
        yellow:
          "bg-[#D4922A] text-[#221205] border border-[#8A5E10] font-semibold " +
          "hover:bg-[#8A5E10] hover:border-[#96651B] hover:text-white " +
          "active:translate-y-px active:shadow-none",

        // ── Danger: stamped red — destructive actions ──────────────────────
        destructive:
          "bg-[#C0392B] text-white border border-[#C0392B] shadow-xs " +
          "hover:bg-[#A5281B] hover:border-[#A5281B] " +
          "active:translate-y-px active:shadow-none focus-visible:ring-red-400",

        // ── Outline: card surface, ink border and text ────────────────────
        // Use on light backgrounds (dashboard panels, modals, forms)
        outline:
          "bg-card text-[#1B2D4F] border border-[#1B2D4F] shadow-none " +
          "hover:bg-[#1B2D4F] hover:text-white " +
          "active:translate-y-px " +
          "dark:bg-transparent dark:text-gray-100 dark:border-gray-500 dark:hover:bg-white/10 dark:hover:text-white",

        // ── Secondary: muted surface, ink text ────────────────────────────
        secondary:
          "bg-muted text-foreground border border-input " +
          "hover:bg-[color-mix(in_oklab,var(--muted)_70%,var(--foreground))] hover:border-border-strong " +
          "active:translate-y-px",

        // ── Ghost: transparent, quiet text — icon/tertiary actions ────────
        ghost:
          "bg-transparent text-muted-foreground border border-transparent " +
          "hover:bg-muted hover:text-foreground " +
          "active:bg-muted " +
          "dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white",

        // ── Link: underline text ──────────────────────────────────────────
        link:
          "bg-transparent text-[#1B2D4F] underline-offset-4 hover:underline " +
          "dark:text-blue-400",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm:      "h-8 rounded-md text-xs px-3 has-[>svg]:px-2.5",
        lg:      "h-11 rounded-lg text-base px-6 has-[>svg]:px-5",
        icon:    "size-9 rounded-md",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
