export function resolvePublicLogoUrl(
  logoUrl: string | null | undefined,
  cacheBust?: Date | string | number | null,
): string | null {
  if (!logoUrl?.trim()) {
    return null;
  }

  let absolute: string;
  if (/^https?:\/\//i.test(logoUrl)) {
    absolute = logoUrl;
  } else {
    const base =
      process.env["PUBLIC_API_URL"]?.replace(/\/$/, "") ??
      `http://localhost:${process.env["PORT"] ?? "3000"}`;
    absolute = `${base}${logoUrl.startsWith("/") ? logoUrl : `/${logoUrl}`}`;
  }

  if (cacheBust == null || cacheBust === "") {
    return absolute;
  }

  const version =
    cacheBust instanceof Date
      ? cacheBust.getTime()
      : typeof cacheBust === "number"
        ? cacheBust
        : Date.parse(String(cacheBust));

  if (!Number.isFinite(version)) {
    return absolute;
  }

  const sep = absolute.includes("?") ? "&" : "?";
  return `${absolute}${sep}v=${version}`;
}
