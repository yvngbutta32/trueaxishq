export type ExportableClient = {
  name: string;
  email: string | null;
  phone: string | null;
  service: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
};

const protectFormula = (value: string) => /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

export function csvCell(value: unknown): string {
  const normalized = protectFormula(value == null ? "" : String(value));
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function buildClientCsv(clients: ExportableClient[]): string {
  const headers = ["Name", "Email", "Phone", "Service", "Status", "Notes", "Created at"];
  const rows = clients.map(client => [
    client.name,
    client.email,
    client.phone,
    client.service,
    client.status,
    client.notes,
    client.createdAt.toISOString(),
  ].map(csvCell).join(","));
  return [headers.map(csvCell).join(","), ...rows].join("\r\n");
}
