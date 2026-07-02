import type { Request, Response } from "express";
import { configuracaoService } from "../lib/configuracao-service.singleton.js";
import {
  defaultConfigHorario,
  parseConfigHorarioInput,
  readHorarioFieldsFromBody,
  serializeConfigHorario,
} from "../lib/configuracao-horario.js";
import { resolvePublicLogoUrl } from "../lib/public-logo-url.js";

type ConfiguracaoRecord = NonNullable<
  Awaited<ReturnType<typeof configuracaoService.get>>
>;

function serializeConfiguracaoResponse(
  config: ConfiguracaoRecord | null,
  logoUrl: string | null = config
    ? resolvePublicLogoUrl(config.logoUrl)
    : null,
) {
  const horario = config
    ? serializeConfigHorario(config.dataInicio, config.dataFim)
    : serializeConfigHorario(
        defaultConfigHorario().dataInicio,
        defaultConfigHorario().dataFim,
      );

  if (!config) {
    return {
      id: null,
      ...horario,
      textoRodapeRelatorio: null,
      logoUrl: null,
    };
  }

  return {
    id: config.id,
    ...horario,
    textoRodapeRelatorio: config.textoRodapeRelatorio ?? null,
    logoUrl,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

function parseHorarioPatchFromBody(body: Record<string, unknown>):
  | { dataInicio: Date; dataFim: Date }
  | undefined {
  const { inicio, fim } = readHorarioFieldsFromBody(body);

  if (inicio === undefined && fim === undefined) {
    return undefined;
  }

  if (inicio === undefined || fim === undefined) {
    throw new Error(
      "Informe horaInicio e horaFim juntos (ou dataInicio e dataFim), ou omita ambos",
    );
  }

  return {
    dataInicio: parseConfigHorarioInput(inicio),
    dataFim: parseConfigHorarioInput(fim),
  };
}

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
      res.json(serializeConfiguracaoResponse(config));
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar configurações" });
    }
  }

  static async upsert(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as Record<string, unknown>;

      const patch: {
        dataInicio?: Date;
        dataFim?: Date;
        textoRodapeRelatorio?: string | null;
        logoUrl?: string | null;
      } = {};

      try {
        const horario = parseHorarioPatchFromBody(body);
        if (horario) {
          patch.dataInicio = horario.dataInicio;
          patch.dataFim = horario.dataFim;
        }
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Horário inválido. Use HH:mm (ex.: 08:00) ou ISO 8601.",
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
      res.json(
        serializeConfiguracaoResponse(
          config,
          resolvePublicLogoUrl(config.logoUrl),
        ),
      );
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
        ...serializeConfiguracaoResponse(
          config,
          resolvePublicLogoUrl(config.logoUrl),
        ),
      });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao enviar logo",
      });
    }
  }
}
