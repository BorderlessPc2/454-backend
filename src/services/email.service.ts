import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getSmtpCredentials } from "../lib/smtp-config.js";

export class EmailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const auth = getSmtpCredentials();
    this.transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth,
    });
    return this.transporter;
  }

  async sendRelatorioPdf(params: {
    to: string;
    clienteNome: string;
    relatorioId: number;
    pdfBuffer: Buffer;
  }): Promise<void> {
    const { user } = getSmtpCredentials();
    await this.getTransporter().sendMail({
      from: user,
      to: params.to,
      subject: `Relatório de Visita Técnica - ${params.clienteNome}`,
      text: "Segue em anexo o relatório de visita técnica.",
      attachments: [
        {
          filename: `Relatorio_${params.relatorioId}.pdf`,
          content: params.pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  }
}
