export function resolvePublicLogoUrl(
  logoUrl: string | null | undefined,
): string | null {
  if (!logoUrl?.trim()) {
    return null;
  }
  if (/^https?:\/\//i.test(logoUrl)) {
    return logoUrl;
  }
  const base =
    process.env["PUBLIC_API_URL"]?.replace(/\/$/, "") ??
    `http://localhost:${process.env["PORT"] ?? "3000"}`;
  return `${base}${logoUrl.startsWith("/") ? logoUrl : `/${logoUrl}`}`;
}
