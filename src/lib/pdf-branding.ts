export type { PdfBranding } from "../services/configuracao.service.js";

import type { ConfiguracaoService } from "../services/configuracao.service.js";

export async function loadPdfBranding(configuracaoService: ConfiguracaoService) {
  return configuracaoService.loadPdfBranding();
}
