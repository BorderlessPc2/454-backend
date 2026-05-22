import type { Request, Response } from "express";
import { ConfiguracaoService } from "../services/configuracao.service.js";
import { prisma } from "../lib/prisma.js";
import { resolvePublicLogoUrl } from "../lib/public-logo-url.js";

const configuracaoService = new ConfiguracaoService(prisma);

export class ConfiguracaoController {
  static async findPdfSettings(_req: Request, res: Response): Promise<void> {
    try {
      const config = await configuracaoService.get();
      if (!config) {
        res.json({
          logoUrl: null,
          textoRodapeRelatorio: null,
        });
        return;
      }

      res.json({
        logoUrl: resolvePublicLogoUrl(config.logoUrl),
        textoRodapeRelatorio: config.textoRodapeRelatorio ?? null,
      });
    } catch {
      res.status(500).json({ error: "Erro ao buscar configurações do PDF" });
    }
  }

  static async findAll(_req: Request, res: Response): Promise<void> {
    try {
      const config = await configuracaoService.get();
      if (!config) {
        res.json(null);
        return;
      }
      res.json({
        ...config,
        logoUrl: resolvePublicLogoUrl(config.logoUrl),
      });
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar configurações" });
    }
  }

  static async upsert(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as {
        dataInicio?: string;
        dataFim?: string;
        textoRodapeRelatorio?: string | null;
        logoUrl?: string | null;
      };

      const patch: {
        dataInicio?: Date;
        dataFim?: Date;
        textoRodapeRelatorio?: string | null;
        logoUrl?: string | null;
      } = {};

      if (body.dataInicio !== undefined && body.dataFim !== undefined) {
        patch.dataInicio = new Date(body.dataInicio);
        patch.dataFim = new Date(body.dataFim);
      } else if (
        body.dataInicio !== undefined ||
        body.dataFim !== undefined
      ) {
        res.status(400).json({
          error:
            "Informe dataInicio e dataFim juntos para alterar o horário, ou omita ambos",
        });
        return;
      }

      if (Object.prototype.hasOwnProperty.call(body, "textoRodapeRelatorio")) {
        const v = body.textoRodapeRelatorio;
        patch.textoRodapeRelatorio =
          v === null || v === undefined
            ? null
            : typeof v === "string"
              ? v
              : String(v);
      }

      if (Object.prototype.hasOwnProperty.call(body, "logoUrl")) {
        const v = body.logoUrl;
        patch.logoUrl =
          v === null || v === undefined
            ? null
            : typeof v === "string"
              ? v
              : String(v);
      }

      const config = await configuracaoService.patch(patch);
      res.json({
        ...config,
        logoUrl: resolvePublicLogoUrl(config.logoUrl),
      });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao salvar configuração",
      });
    }
  }

  static async uploadLogo(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Arquivo de logo é obrigatório." });
        return;
      }

      const config = await configuracaoService.saveLogoFile({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      });

      res.json({
        ...config,
        logoUrl: resolvePublicLogoUrl(config.logoUrl),
      });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao enviar logo",
      });
    }
  }
}
