import { Prisma, PrismaClient } from "@prisma/client";
import { writeSystemLogoFile } from "../lib/logo-upload.js";

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

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

export class ConfiguracaoService {
  constructor(private prisma: PrismaClient) {}

  async get() {
    try {
      return await this.prisma.configuracao.findFirst();
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
      return this.prisma.configuracao.create({
        data: {
          id: 1,
          dataInicio: horario.dataInicio,
          dataFim: horario.dataFim,
          ...(hasRodape
            ? { textoRodapeRelatorio: opts.textoRodapeRelatorio }
            : {}),
          ...(hasLogo ? { logoUrl: opts.logoUrl } : {}),
        },
      });
    }

    return this.prisma.configuracao.update({
      where: { id: existing.id },
      data: {
        ...(hasHorario
          ? { dataInicio: opts.dataInicio!, dataFim: opts.dataFim! }
          : {}),
        ...(hasRodape
          ? { textoRodapeRelatorio: opts.textoRodapeRelatorio }
          : {}),
        ...(hasLogo ? { logoUrl: opts.logoUrl } : {}),
      },
    });
  }

  /** Atualiza somente logoUrl — não altera horário nem rodapé. */
  async updateLogoUrl(logoUrl: string) {
    const existing = await this.prisma.configuracao.findFirst();

    if (!existing) {
      const horario = this.defaultHorarioDoDia();
      return this.prisma.configuracao.create({
        data: {
          dataInicio: horario.dataInicio,
          dataFim: horario.dataFim,
          logoUrl,
        },
      });
    }

    return this.prisma.configuracao.update({
      where: { id: existing.id },
      data: { logoUrl },
    });
  }

  async saveLogoFile(file: LogoUploadFile) {
    const { logoPath } = await writeSystemLogoFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    return this.updateLogoUrl(logoPath);
  }

  /** Mantido para uso legado ou scripts; preferir `patch`. */
  async upsert(dataInicio: Date, dataFim: Date) {
    return this.patch({ dataInicio, dataFim });
  }
}
