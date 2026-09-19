export type ProposalPackageLineItem = {
  id: string;
  name: string;
  description?: string;
  qty: number;
  unitPrice: number;
  total: number;
};

export type ProposalPackage = {
  id: string;
  name: string;
  description?: string;
  recommended?: boolean;
  lineItems: ProposalPackageLineItem[];
};

export function normalizeProposalLineItems(items: ProposalPackageLineItem[]): ProposalPackageLineItem[] {
  return items.map(item => ({ ...item, total: Math.round(item.qty * item.unitPrice * 100) / 100 }));
}

export function getProposalPackageSubtotal(proposalPackage: ProposalPackage): number {
  return normalizeProposalLineItems(proposalPackage.lineItems).reduce((sum, item) => sum + item.total, 0);
}

/** Parses stored package JSON defensively for public token rendering. */
export function parseProposalPackages(value: string | null | undefined): ProposalPackage[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(raw => {
      if (!raw || typeof raw !== "object") return [];
      const candidate = raw as Partial<ProposalPackage>;
      if (typeof candidate.id !== "string" || !candidate.id || typeof candidate.name !== "string" || !candidate.name || !Array.isArray(candidate.lineItems) || candidate.lineItems.length === 0) return [];
      const lineItems = candidate.lineItems.flatMap(item => {
        if (!item || typeof item !== "object") return [];
        const line = item as Partial<ProposalPackageLineItem>;
        if (typeof line.id !== "string" || typeof line.name !== "string" || typeof line.qty !== "number" || typeof line.unitPrice !== "number" || !Number.isFinite(line.qty) || !Number.isFinite(line.unitPrice) || line.qty < 0 || line.unitPrice < 0) return [];
        return [{ id: line.id, name: line.name, description: typeof line.description === "string" ? line.description : undefined, qty: line.qty, unitPrice: line.unitPrice, total: 0 }];
      });
      if (lineItems.length !== candidate.lineItems.length) return [];
      return [{ id: candidate.id, name: candidate.name, description: typeof candidate.description === "string" ? candidate.description : undefined, recommended: candidate.recommended === true ? true : undefined, lineItems: normalizeProposalLineItems(lineItems) }];
    });
  } catch {
    return [];
  }
}
