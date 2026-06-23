import { ConfiguracaoService } from "../services/configuracao.service.js";
import { prisma } from "./prisma.js";

/** Instância única — evita cache de configuração divergente entre controllers. */
export const configuracaoService = new ConfiguracaoService(prisma);
