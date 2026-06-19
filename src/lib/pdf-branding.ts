import type { ConfiguracaoService } from "../services/configuracao.service.js";
import { normalizeLogoStoragePath } from "./normalize-logo-path.js";
import { resolvePublicLogoUrl } from "./public-logo-url.js";
import { resolveLogoDataUrl } from "./resolve-logo-data-url.js";

export type PdfBranding = {
  logoStoragePath: string | null;
  logoUrl: string | null;
  logoDataUrl: string | null;
  textoRodapeRelatorio: string | null;
};

export async function loadPdfBranding(
  configuracaoService: ConfiguracaoService,
): Promise<PdfBranding> {
  const config = await configuracaoService.get();
  const logoStoragePath = normalizeLogoStoragePath(config?.logoUrl);
  const logoDataUrl = await resolveLogoDataUrl(logoStoragePath);

  return {
    logoStoragePath,
    logoUrl: resolvePublicLogoUrl(logoStoragePath),
    logoDataUrl,
    textoRodapeRelatorio: config?.textoRodapeRelatorio ?? null,
  };
}
