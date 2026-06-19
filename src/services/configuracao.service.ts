import { Prisma, PrismaClient } from "@prisma/client";
import { writeSystemLogoFile, buildLogoDataUrl } from "../lib/logo-upload.js";
import { normalizeLogoStoragePath } from "../lib/normalize-logo-path.js";
import { resolvePublicLogoUrl } from "../lib/public-logo-url.js";
import { resolveLogoDataUrl } from "../lib/resolve-logo-data-url.js";

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
  logoStoragePath: string | null;
  logoUrl: string | null;
  logoDataUrl: string | null;
  textoRodapeRelatorio: string | null;
};

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

const CONFIG_CACHE_TTL_MS = 60_000;

export class ConfiguracaoService {
  private configCache: {
    data: Awaited<ReturnType<ConfiguracaoService["fetchConfig"]>> | null;
    expiresAt: number;
  } | null = null;

  constructor(private prisma: PrismaClient) {}

  private invalidateConfigCache(): void {
    this.configCache = null;
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
    if (this.configCache && this.configCache.expiresAt > now) {
      return this.configCache.data;
    }

    const data = await this.fetchConfig();
    this.configCache = { data, expiresAt: now + CONFIG_CACHE_TTL_MS };
    return data;
  }

  private defaultHorarioDoDia(): { dataInicio: Date; dataFim: Date } {
    const dataInicio = new Date();
    dataInicio.setHours(8, 0, 0, 0);
    const dataFim = new Date();
    dataFim.setHours(18, 0, 0, 0);
    return { dataInicio, dataFim };
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
      if (!isValidDate(opts.dataInicio!)) {
        throw new Error("dataInicio inválida");
      }
      if (!isValidDate(opts.dataFim!)) {
        throw new Error("dataFim inválida");
      }
      if (opts.dataFim! < opts.dataInicio!) {
        throw new Error("dataFim deve ser posterior ou igual a dataInicio");
      }
    }

    const existing = await this.prisma.configuracao.findFirst();

    if (!existing) {
      const horario = hasHorario
        ? { dataInicio: opts.dataInicio!, dataFim: opts.dataFim! }
        : this.defaultHorarioDoDia();
      const created = await this.prisma.configuracao.create({
        data: {
          id: 1,
          dataInicio: horario.dataInicio,
          dataFim: horario.dataFim,
          ...(hasRodape
            ? { textoRodapeRelatorio: opts.textoRodapeRelatorio }
            : {}),
          ...(hasLogo
            ? {
                logoUrl: normalizeLogoStoragePath(opts.logoUrl),
                logoDataUrl: null,
              }
            : {}),
        },
      });
      this.invalidateConfigCache();
      return created;
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
        ...(hasLogo
          ? {
              logoUrl: normalizeLogoStoragePath(opts.logoUrl),
              logoDataUrl: null,
            }
          : {}),
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

  async loadPdfBranding(): Promise<PdfBranding> {
    const config = await this.get();
    const logoStoragePath = normalizeLogoStoragePath(config?.logoUrl);
    let logoDataUrl = config?.logoDataUrl ?? null;

    if (!logoDataUrl) {
      logoDataUrl = await resolveLogoDataUrl(logoStoragePath);
      if (logoDataUrl && config?.id) {
        await this.prisma.configuracao
          .update({
            where: { id: config.id },
            data: { logoDataUrl },
          })
          .catch(() => undefined);
        this.invalidateConfigCache();
      }
    }

    return {
      logoStoragePath,
      logoUrl: resolvePublicLogoUrl(logoStoragePath),
      logoDataUrl,
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
