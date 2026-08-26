import { AlertCircle, ArrowLeft, LockKeyhole } from "lucide-react";

type PublicRecoveryStateProps = {
  eyebrow?: string;
  title: string;
  description: string;
  privacyNote?: string;
  actionLabel?: string;
  tone?: "alert" | "neutral";
};

/** A consistent safe exit for public links that have expired, been revoked, or are mistyped. */
export function PublicRecoveryState({
  eyebrow = "TrueAxis HQ",
  title,
  description,
  privacyNote,
  actionLabel = "Return to TrueAxis HQ",
  tone = "alert",
}: PublicRecoveryStateProps) {
  const accent = tone === "alert" ? "#FF6B6B" : "#00A88F";
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#F7F6F3] px-5 py-10" aria-labelledby="public-recovery-title">
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle at 82% 14%, rgba(0,168,143,0.13), transparent 31%), radial-gradient(circle at 12% 86%, rgba(255,107,107,0.10), transparent 28%)" }} />
      <section className="relative w-full max-w-md overflow-hidden rounded-[1.5rem] border border-[rgba(27,45,79,0.11)] bg-white p-7 text-center shadow-[0_24px_70px_rgba(27,45,79,0.14)] sm:p-9">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, #00A88F, ${accent}, #1B2D4F)` }} />
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#1B2D4F] px-3 py-1.5 text-xs font-bold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00C9A7]" aria-hidden="true" />
          {eyebrow}
        </div>
        <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `${accent}18`, border: `1px solid ${accent}45` }}>
          <AlertCircle className="h-7 w-7" style={{ color: accent }} aria-hidden="true" />
        </div>
        <h1 id="public-recovery-title" className="mt-5 text-2xl font-extrabold tracking-[-0.03em] text-[#1A1A1A]">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#525252]">{description}</p>
        <a href="/" className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1B2D4F] px-5 text-sm font-bold text-white no-underline transition hover:bg-[#243D6B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A88F] focus-visible:ring-offset-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {actionLabel}
        </a>
        {privacyNote && <p className="mt-5 flex items-start justify-center gap-2 text-xs leading-5 text-[#666]" role="note"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#007A68]" aria-hidden="true" />{privacyNote}</p>}
      </section>
    </main>
  );
}
