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
  // Base — shared across all variants
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg",
    "text-sm font-semibold transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A020] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  ].join(" "),
  {
    variants: {
      variant: {
        // ── Primary: navy background, white text ──────────────────────────
        default:
          "bg-[#1D3557] text-white border-2 border-[#1D3557] shadow-sm " +
          "hover:bg-[#122240] hover:border-[#122240] hover:shadow-md hover:-translate-y-px " +
          "active:translate-y-0 active:shadow-sm",

        // ── Yellow / Amber: golden yellow, dark text ───────────────────────
        yellow:
          "bg-[#FFB703] text-[#0F1923] border-2 border-[#FFB703] shadow-sm font-bold " +
          "hover:bg-[#D99500] hover:border-[#D99500] hover:shadow-md hover:-translate-y-px " +
          "active:translate-y-0 active:shadow-sm",

        // ── Danger: red background, white text ────────────────────────────
        destructive:
          "bg-[#E63946] text-white border-2 border-[#E63946] shadow-sm " +
          "hover:bg-[#C02030] hover:border-[#C02030] hover:shadow-md hover:-translate-y-px " +
          "active:translate-y-0 focus-visible:ring-red-400",

        // ── Outline: white bg, navy border and text ───────────────────────
        // Use on white/light gray backgrounds (dashboard panels, modals, forms)
        outline:
          "bg-white text-[#1D3557] border-2 border-[#1D3557] shadow-xs " +
          "hover:bg-[#1D3557] hover:text-white hover:-translate-y-px hover:shadow-sm " +
          "active:translate-y-0 " +
          "dark:bg-transparent dark:text-gray-100 dark:border-gray-500 dark:hover:bg-white/10 dark:hover:text-white",

        // ── Secondary: light gray bg, dark text ───────────────────────────
        secondary:
          "bg-[#EEF0F4] text-[#1D3557] border border-[#DDE1E8] " +
          "hover:bg-[#DDE1E8] hover:border-[#C8CDD6] hover:-translate-y-px " +
          "active:translate-y-0",

        // ── Ghost: transparent, gray text — for icon buttons and tertiary actions ──
        // Works on white/light backgrounds
        ghost:
          "bg-transparent text-[#3A4A5C] border border-transparent " +
          "hover:bg-[#EEF0F4] hover:text-[#1D3557] hover:border-[#DDE1E8] " +
          "active:bg-[#DDE1E8] " +
          "dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white",

        // ── Link: underline text ──────────────────────────────────────────
        link:
          "bg-transparent text-[#1D3557] underline-offset-4 hover:underline " +
          "dark:text-blue-400",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm:      "h-8 rounded-md text-xs px-3 has-[>svg]:px-2.5",
        lg:      "h-12 rounded-xl text-base px-7 has-[>svg]:px-5",
        icon:    "size-10 rounded-lg",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-11 rounded-xl",
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
