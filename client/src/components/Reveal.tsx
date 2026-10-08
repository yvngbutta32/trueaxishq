import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveal — scroll-triggered entrance choreography for public surfaces.
 *
 * A thin IntersectionObserver wrapper: content rises into place the first time
 * it enters the viewport, once, using the app's shared easing. With
 * `cascade`, direct children enter in sequence instead of as one block.
 *
 * Accessibility: prefers-reduced-motion lands content instantly with no
 * transition (also enforced globally in index.css — this check keeps the
 * component honest on its own).
 */
export function Reveal({
  children,
  className = "",
  cascade = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Children rise one after another instead of as a single block. */
  cascade?: boolean;
  /** Render tag for the wrapper (div by default). */
  as?: "div" | "section";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    // Content already in the first viewport reveals immediately after paint.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${shown ? "reveal-shown" : ""} ${cascade ? "reveal-cascade" : ""} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}
