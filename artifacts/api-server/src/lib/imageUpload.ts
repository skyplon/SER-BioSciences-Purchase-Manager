export function buildInvoiceImageUrl(invoiceId: number): string | null {
  const domains = process.env.REPLIT_DOMAINS ?? "";
  const domain = domains.split(",")[0]?.trim();
  if (!domain) return null;
  return `https://${domain}/api/invoices/${invoiceId}/image`;
}
