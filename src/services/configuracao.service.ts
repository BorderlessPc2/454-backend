import { Prisma, PrismaClient } from "@prisma/client";
import { writeSystemLogoFile, buildLogoDataUrl } from "../lib/logo-upload.js";
import { normalizeLogoStoragePath } from "../lib/normalize-logo-path.js";
import { resolvePublicLogoUrl } from "../lib/public-logo-url.js";
import {
  defaultConfigHorario,
  normalizeStoredConfigHorario,
  normalizeConfigHorarioPair,
} from "../lib/configuracao-horario.js";
import {
  resolveLogoDataUrl,
  resolveLogoForPdfFromConfig,
  isValidLogoDataUrl,
} from "../lib/resolve-logo-data-url.js";

export type ConfiguracaoPatchInput = {
  dataInicio?: Date;
  dataFim?: Date;
  textoRodapeRelatorio?: string | null;
  logoUrl?: string | null;
};

export type LogoUploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

export type PdfBranding = {
  /** Caminho normalizado (/uploads/...). */
  logoStoragePath: string | null;
  /** Valor bruto de `logo_url` no banco (mesma fonte da sidebar). */
  rawLogoUrl: string | null;
  /** URL pública retornada por GET /configuracoes/pdf. */
  logoUrl: string | null;
  logoDataUrl: string | null;
  textoRodapeRelatorio: string | null;
};

let sharedConfigCache: {
  data: Awaited<ReturnType<ConfiguracaoService["fetchConfig"]>> | null;
  expiresAt: number;
} | null = null;

const CONFIG_CACHE_TTL_MS = 60_000;

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

export class ConfiguracaoService {
  constructor(private prisma: PrismaClient) {}

  private invalidateConfigCache(): void {
    sharedConfigCache = null;
  }

  private async fetchConfig() {
    try {
      return await this.prisma.configuracao.findFirst({
        select: {
          id: true,
          dataInicio: true,
          dataFim: true,
          textoRodapeRelatorio: true,
          logoUrl: true,
          logoDataUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021"
      ) {
        return null;
      }

      throw error;
    }
  }

  async get() {
    const now = Date.now();
    if (sharedConfigCache && sharedConfigCache.expiresAt > now) {
      return sharedConfigCache.data;
    }

    const raw = await this.fetchConfig();
    if (!raw) {
      sharedConfigCache = { data: null, expiresAt: now + CONFIG_CACHE_TTL_MS };
      return null;
    }

    const normalized = normalizeStoredConfigHorario(
      raw.dataInicio,
      raw.dataFim,
    );
    const isLegacyAnchor =
      raw.dataInicio.getUTCFullYear() !== 1970 ||
      raw.dataFim.getUTCFullYear() !== 1970;

    if (isLegacyAnchor) {
      const updated = await this.prisma.configuracao.update({
        where: { id: raw.id },
        data: normalized,
      });
      const data = { ...raw, ...updated, ...normalized };
      sharedConfigCache = { data, expiresAt: now + CONFIG_CACHE_TTL_MS };
      return data;
    }

    const data = { ...raw, ...normalized };
    sharedConfigCache = { data, expiresAt: now + CONFIG_CACHE_TTL_MS };
    return data;
  }

  private async resolveLogoDataUrlForStorage(
    logoUrl: string | null | undefined,
    existingLogoUrl: string | null | undefined,
    existingLogoDataUrl: string | null | undefined,
  ): Promise<{ logoUrl: string | null; logoDataUrl: string | null }> {
    const normalizedPath = normalizeLogoStoragePath(logoUrl);
    const existingNormalizedPath = normalizeLogoStoragePath(existingLogoUrl);

    if (!normalizedPath) {
      return { logoUrl: null, logoDataUrl: null };
    }

    if (
      normalizedPath === existingNormalizedPath &&
      isValidLogoDataUrl(existingLogoDataUrl)
    ) {
      return {
        logoUrl: normalizedPath,
        logoDataUrl: existingLogoDataUrl.trim(),
      };
    }

    const logoDataUrl = await resolveLogoDataUrl(normalizedPath, logoUrl);
    return {
      logoUrl: normalizedPath,
      logoDataUrl: isValidLogoDataUrl(logoDataUrl) ? logoDataUrl.trim() : null,
    };
  }

  private defaultHorarioDoDia(): { dataInicio: Date; dataFim: Date } {
    return defaultConfigHorario();
  }

  /**
   * Atualiza horário de login, rodapé do relatório e/ou logo.
   * Exige pelo menos um bloco no body do PUT.
   */
  async patch(opts: ConfiguracaoPatchInput) {
    const hasHorario =
      opts.dataInicio !== undefined && opts.dataFim !== undefined;
    const hasRodape = opts.textoRodapeRelatorio !== undefined;
    const hasLogo = opts.logoUrl !== undefined;

    if (!hasHorario && !hasRodape && !hasLogo) {
      throw new Error(
        "Informe dataInicio e dataFim (juntos), textoRodapeRelatorio e/ou logoUrl",
      );
    }

    if (
      (opts.dataInicio !== undefined) !== (opts.dataFim !== undefined)
    ) {
      throw new Error(
        "Informe dataInicio e dataFim juntos para alterar o horário de login",
      );
    }

    if (hasHorario) {
      const horarioNormalizado = normalizeConfigHorarioPair(
        opts.dataInicio!,
        opts.dataFim!,
      );
      opts = {
        ...opts,
        dataInicio: horarioNormalizado.dataInicio,
        dataFim: horarioNormalizado.dataFim,
      };

      if (!isValidDate(opts.dataInicio!)) {
        throw new Error("dataInicio inválida");
      }
      if (!isValidDate(opts.dataFim!)) {
        throw new Error("dataFim inválida");
      }
    }

    const existing = await this.prisma.configuracao.findFirst();

    if (!existing) {
      const horario = hasHorario
        ? { dataInicio: opts.dataInicio!, dataFim: opts.dataFim! }
        : this.defaultHorarioDoDia();

      let logoPatch: { logoUrl: string | null; logoDataUrl: string | null } = {
        logoUrl: null,
        logoDataUrl: null,
      };
      if (hasLogo) {
        logoPatch = await this.resolveLogoDataUrlForStorage(
          opts.logoUrl,
          null,
          null,
        );
      }

      const created = await this.prisma.configuracao.create({
        data: {
          id: 1,
          dataInicio: horario.dataInicio,
          dataFim: horario.dataFim,
          ...(hasRodape
            ? { textoRodapeRelatorio: opts.textoRodapeRelatorio }
            : {}),
          ...(hasLogo ? logoPatch : {}),
        },
      });
      this.invalidateConfigCache();
      return created;
    }

    let logoPatch: { logoUrl?: string | null; logoDataUrl?: string | null } =
      {};
    if (hasLogo) {
      logoPatch = await this.resolveLogoDataUrlForStorage(
        opts.logoUrl,
        existing.logoUrl,
        existing.logoDataUrl,
      );
    }

    const updated = await this.prisma.configuracao.update({
      where: { id: existing.id },
      data: {
        ...(hasHorario
          ? { dataInicio: opts.dataInicio!, dataFim: opts.dataFim! }
          : {}),
        ...(hasRodape
          ? { textoRodapeRelatorio: opts.textoRodapeRelatorio }
          : {}),
        ...logoPatch,
      },
    });
    this.invalidateConfigCache();
    return updated;
  }

  /** Atualiza logo (caminho público + base64 embutido para PDF). */
  async updateLogo(logoUrl: string, logoDataUrl: string | null) {
    const existing = await this.prisma.configuracao.findFirst();

    if (!existing) {
      const horario = this.defaultHorarioDoDia();
      const created = await this.prisma.configuracao.create({
        data: {
          dataInicio: horario.dataInicio,
          dataFim: horario.dataFim,
          logoUrl,
          logoDataUrl,
        },
      });
      this.invalidateConfigCache();
      return created;
    }

    const updated = await this.prisma.configuracao.update({
      where: { id: existing.id },
      data: { logoUrl, logoDataUrl },
    });
    this.invalidateConfigCache();
    return updated;
  }

  /** Branding para PDF — sempre lê config fresca do banco (sem cache). */
  async loadPdfBranding(): Promise<PdfBranding> {
    const config = await this.fetchConfig();
    const rawLogoUrl = config?.logoUrl ?? null;
    const logoStoragePath = normalizeLogoStoragePath(rawLogoUrl);
    const resolved = await resolveLogoForPdfFromConfig({
      logoDataUrl: config?.logoDataUrl,
      logoStoragePath,
      logoUrl: rawLogoUrl,
    });

    if (
      resolved.logoDataUrl &&
      config?.id &&
      config.logoDataUrl !== resolved.logoDataUrl
    ) {
      await this.prisma.configuracao
        .update({
          where: { id: config.id },
          data: { logoDataUrl: resolved.logoDataUrl },
        })
        .catch(() => undefined);
      this.invalidateConfigCache();
    }

    return {
      logoStoragePath,
      rawLogoUrl,
      logoUrl: resolvePublicLogoUrl(rawLogoUrl),
      logoDataUrl: resolved.logoDataUrl,
      textoRodapeRelatorio: config?.textoRodapeRelatorio ?? null,
    };
  }

  /** @deprecated Use updateLogo */
  async updateLogoUrl(logoUrl: string) {
    return this.updateLogo(logoUrl, null);
  }

  async saveLogoFile(file: LogoUploadFile) {
    const { logoPath } = await writeSystemLogoFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    const logoDataUrl = buildLogoDataUrl(
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    return this.updateLogo(logoPath, logoDataUrl);
  }

  /** Mantido para uso legado ou scripts; preferir `patch`. */
  async upsert(dataInicio: Date, dataFim: Date) {
    return this.patch({ dataInicio, dataFim });
  }
}
