import type { ReactNode } from "react";

/**
 * Shared page chrome for the public client journey (proposal signing, booking
 * changes, payment confirmations). One shell so every token-based page the
 * client touches has the same surface instead of per-page scaffolding.
 */
export function PublicShell({ children, width = "md" }: { children: ReactNode; width?: "md" | "lg" }) {
  return (
    <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-lg w-full ${width === "md" ? "max-w-md" : "max-w-2xl"} text-center`}>
        {children}
      </div>
    </div>
  );
}
