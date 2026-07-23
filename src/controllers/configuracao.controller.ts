import type { Request, Response } from "express";
import { configuracaoService } from "../lib/configuracao-service.singleton.js";
import {
  defaultConfigHorario,
  parseConfigHorarioInput,
  readHorarioFieldsFromBody,
  serializeConfigHorario,
} from "../lib/configuracao-horario.js";
import { resolvePublicLogoUrl } from "../lib/public-logo-url.js";
import {
  parseBrandThemePalette,
  type BrandThemePalette,
} from "../lib/brand-theme.js";

type ConfiguracaoRecord = NonNullable<
  Awaited<ReturnType<typeof configuracaoService.get>>
>;

function serializeConfiguracaoResponse(
  config: ConfiguracaoRecord | null,
  logoUrl?: string | null,
  logoDarkUrl?: string | null,
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
      logoDarkUrl: null,
      themePalette: null,
    };
  }

  const cacheBust = config.updatedAt;
  const resolvedLogoUrl =
    logoUrl !== undefined
      ? logoUrl
      : resolvePublicLogoUrl(config.logoUrl, cacheBust);
  const resolvedLogoDarkUrl =
    logoDarkUrl !== undefined
      ? logoDarkUrl
      : resolvePublicLogoUrl(config.logoDarkUrl, cacheBust);

  return {
    id: config.id,
    ...horario,
    textoRodapeRelatorio: config.textoRodapeRelatorio ?? null,
    logoUrl: resolvedLogoUrl,
    logoDarkUrl: resolvedLogoDarkUrl,
    themePalette: parseBrandThemePalette(config.themePalette),
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
          themePalette: null,
        });
        return;
      }

      res.json({
        logoUrl: resolvePublicLogoUrl(config.logoUrl),
        textoRodapeRelatorio: config.textoRodapeRelatorio ?? null,
        themePalette: parseBrandThemePalette(config.themePalette),
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
        logoDarkUrl?: string | null;
        themePalette?: BrandThemePalette | null;
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

      if (Object.prototype.hasOwnProperty.call(body, "logoDarkUrl")) {
        const v = body.logoDarkUrl;
        patch.logoDarkUrl =
          v === null || v === undefined
            ? null
            : typeof v === "string"
              ? v
              : String(v);
      }

      if (Object.prototype.hasOwnProperty.call(body, "themePalette")) {
        const v = body.themePalette;
        if (v === null || v === undefined) {
          patch.themePalette = null;
        } else {
          const parsed = parseBrandThemePalette(v);
          if (!parsed) {
            res.status(400).json({ error: "themePalette inválida." });
            return;
          }
          patch.themePalette = parsed;
        }
      }

      const config = await configuracaoService.patch(patch);
      res.json(serializeConfiguracaoResponse(config));
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

      let themePalette: BrandThemePalette | null | undefined;
      const rawTheme = (req.body as Record<string, unknown>).themePalette;
      if (rawTheme !== undefined && rawTheme !== null && rawTheme !== "") {
        try {
          const parsed =
            typeof rawTheme === "string" ? JSON.parse(rawTheme) : rawTheme;
          if (!parseBrandThemePalette(parsed)) {
            res.status(400).json({ error: "themePalette inválida." });
            return;
          }
          themePalette = parsed;
        } catch {
          res.status(400).json({ error: "themePalette inválida." });
          return;
        }
      }

      const config = await configuracaoService.saveLogoFile(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
        },
        themePalette,
      );

      res.json(serializeConfiguracaoResponse(config));
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao enviar logo",
      });
    }
  }

  static async uploadLogoDark(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Arquivo de logo escura é obrigatório." });
        return;
      }

      let themePalette: BrandThemePalette | null | undefined;
      const rawTheme = (req.body as Record<string, unknown>).themePalette;
      if (rawTheme !== undefined && rawTheme !== null && rawTheme !== "") {
        try {
          const parsed =
            typeof rawTheme === "string" ? JSON.parse(rawTheme) : rawTheme;
          if (!parseBrandThemePalette(parsed)) {
            res.status(400).json({ error: "themePalette inválida." });
            return;
          }
          themePalette = parsed;
        } catch {
          res.status(400).json({ error: "themePalette inválida." });
          return;
        }
      }

      const config = await configuracaoService.saveLogoDarkFile(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
        },
        themePalette,
      );

      res.json(serializeConfiguracaoResponse(config));
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao enviar logo escura",
      });
    }
  }
}
