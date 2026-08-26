const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A proposal date is valid through 23:59:59.999 UTC on the specified day. */
export function isProposalExpired(validUntil: string | null | undefined, now = new Date()): boolean {
  if (!validUntil) return false;
  if (!DATE_ONLY.test(validUntil)) return true;
  const finalMoment = Date.parse(`${validUntil}T23:59:59.999Z`);
  return !Number.isFinite(finalMoment) || now.getTime() > finalMoment;
}
