import { readFileSync } from "fs";
import {
  launchChromiumBrowser,
  RelatorioPdfUnavailableError,
} from "../lib/chromium-launcher.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { escapeHtml } from "../lib/escape-html.js";
import {
  buildHorarioTableRows,
  calcularTotalHoras,
} from "../lib/relatorio-pdf-horarios.js";
import {
  mapConfiguracoesToPdfFooter,
  type RelatorioPdfFooterConfig,
} from "../lib/relatorio-pdf-footer.js";
import { formatDateWallClock } from "../lib/horario-datetime.js";
import { resolveLogoDataUrl } from "../lib/resolve-logo-data-url.js";
import { sanitizeRichTextHtml } from "../lib/sanitize-rich-text.js";

export type RelatorioPdfData = {
  id: number;
  dataVisita: Date | string;
  modalidadeServico?: string | null;
  numeroContrato?: string | null;
  localizacaoCidade?: string | null;
  localizacaoEstado?: string | null;
  observacoes: string | null;
  contatoCargo?: string | null;
  cliente: {
    nomeFantasia: string;
    cidade?: string | null;
    estado?: string | null;
  };
  contato: { nome: string; cargo?: string | null } | null;
  criadoPor: { nome: string };
  tecnicos: { nome: string }[];
  setores: {
    observacao: string | null;
    setor: { nome: string };
  }[];
  horarios: {
    horaChegada: Date | string;
    horaSaida: Date | string;
  }[];
};

export type PdfConfig = {
  /** Caminho salvo no banco (ex.: /uploads/system-logo.png). */
  logoStoragePath: string | null;
  /** Quando já resolvido (ex.: pelo controller), evita nova leitura/fetch. */
  logoDataUrl?: string | null;
  textoRodapeRelatorio: string | null;
};

export { RelatorioPdfUnavailableError } from "../lib/chromium-launcher.js";

const LEGAL_TEXT =
  "A LINQ INFORMÁTICA EIRELI-ME, seus diretores, sócios e funcionários, ficam ISENTOS DE QUAISQUER RESPONSABILIDADES, " +
  "sejam elas jurídicas, cíveis, penais ou criminais, referentes ao USO DE LICENÇAS DE SOFTWARE pela EMPRESA CONTRATANTE, " +
  "na sua sede matriz e respectivas filiais.";

function fieldOrNA(value: string | null | undefined): string {
  if (value == null || String(value).trim() === "") {
    return "N/A";
  }
  return String(value);
}

function parseDate(iso: Date | string): Date | null {
  const d = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDatePdf(d: Date): string {
  return formatDateWallClock(d);
}

function buildCidadeCliente(relatorio: RelatorioPdfData): string {
  const c = relatorio.cliente.cidade?.trim();
  const e = relatorio.cliente.estado?.trim();
  if (c && e) return `${c}/${e}`;
  if (c || e) return fieldOrNA(c ?? e);
  const lc = relatorio.localizacaoCidade?.trim();
  const le = relatorio.localizacaoEstado?.trim();
  if (lc && le) return `${lc}/${le}`;
  if (lc || le) return fieldOrNA(lc ?? le);
  return "N/A";
}

function loadCss(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  const cssPath = join(dir, "..", "templates", "relatorio-pdf.css");
  return readFileSync(cssPath, "utf-8");
}

function renderHorariosTable(
  horarios: RelatorioPdfData["horarios"],
): string {
  if (horarios.length === 0) {
    return '<p class="empty-line">Sem horários informados.</p>';
  }

  const rows = buildHorarioTableRows(horarios);
  const totalHoras = calcularTotalHoras(horarios);

  const bodyRows = rows
    .map(
      (row) => `
      <div class="horario-table-row">
        <div class="horario-cell-periodo">${escapeHtml(row.periodo)}</div>
        <div class="horario-cell-intervalo">${escapeHtml(row.intervalo)}</div>
        <div class="horario-cell-duracao">${escapeHtml(row.duracao)}</div>
      </div>`,
    )
    .join("");

  return `
    <div class="horario-table">
      <div class="horario-table-head">
        <div class="horario-head-text horario-cell-periodo">Período</div>
        <div class="horario-head-text horario-cell-intervalo">Horário</div>
        <div class="horario-head-text horario-cell-duracao">Total</div>
      </div>
      ${bodyRows}
      <div class="total-horas-row">
        <div class="total-horas-label">Total de Horas</div>
        <div class="total-horas-value">${escapeHtml(totalHoras)}</div>
      </div>
    </div>`;
}

function renderSetores(setores: RelatorioPdfData["setores"]): string {
  if (setores.length === 0) {
    return "";
  }

  return setores
    .map((setor) => {
      const nome = escapeHtml(fieldOrNA(setor.setor.nome));
      const obs = setor.observacao?.trim();
      const obsHtml = obs
        ? `<div class="bullet-line">• ${escapeHtml(obs)}</div>`
        : "";
      return `<div class="setor-block"><div class="setor-title">${nome}</div>${obsHtml}</div>`;
    })
    .join("");
}

function renderFooterLines(footer: RelatorioPdfFooterConfig): string {
  return footer.lines
    .map((line) => `<div class="footer-left-line">${escapeHtml(line)}</div>`)
    .join("");
}

function renderObservacoes(observacoes: string | null): string {
  const sanitized = sanitizeRichTextHtml(observacoes);
  if (!sanitized) {
    return '<p class="empty-line">Sem detalhamento informado.</p>';
  }
  return `<div class="servicos-html">${sanitized}</div>`;
}

export class RelatorioPdfService {
  buildHtml(
    relatorio: RelatorioPdfData,
    config: PdfConfig,
    logoDataUrl: string | null,
  ): string {
    const css = loadCss();
    const footer = mapConfiguracoesToPdfFooter(config.textoRodapeRelatorio);

    const tecnicoNome = fieldOrNA(
      relatorio.tecnicos[0]?.nome ?? relatorio.criadoPor.nome,
    );
    const contatoNome = fieldOrNA(relatorio.contato?.nome);
    const contatoCargo = fieldOrNA(
      relatorio.contatoCargo ?? relatorio.contato?.cargo,
    );
    const clienteNome = fieldOrNA(relatorio.cliente.nomeFantasia);
    const dataVisita = parseDate(relatorio.dataVisita);
    const responsavelCliente =
      contatoNome !== "N/A" ? contatoNome : "Responsável pelo Cliente";

    const titulo = `Relatório Técnico - ${relatorio.id}`;
    const setoresHtml = renderSetores(relatorio.setores);
    const observacoesHtml = renderObservacoes(relatorio.observacoes);
    const horariosHtml = renderHorariosTable(relatorio.horarios);

    const headerLogoBlock = logoDataUrl
      ? `<img src="${logoDataUrl}" alt="Logo" class="header-logo" />`
      : `<span class="logo-text">Linq</span>`;
    const footerLogoImg = logoDataUrl
      ? `<img src="${logoDataUrl}" alt="Logo" class="footer-logo" />`
      : "";

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <style>${css}</style>
</head>
<body>
  <div class="page">
    <div class="page-main">
      <header class="header">
        <div class="logo-box">
          ${headerLogoBlock}
        </div>
        <div class="title-box">
          <h1 class="page-title">${escapeHtml(titulo.toUpperCase())}</h1>
        </div>
        <div class="header-meta">
          <div class="meta-line">Nº ${relatorio.id}</div>
          <div class="meta-line">Data: ${dataVisita ? escapeHtml(formatDatePdf(dataVisita)) : "N/A"}</div>
        </div>
      </header>

      <div class="section-title-wrap">
        <div class="section-title">Informações do Cliente</div>
      </div>
      <div class="section-body">
        <div class="info-row">
          <div class="info-line-full"><span class="label">Cliente: </span>${escapeHtml(clienteNome)}</div>
        </div>
        <div class="info-row">
          <div class="info-line"><span class="label">Contato: </span>${escapeHtml(contatoNome)}</div>
          <div class="info-line"><span class="label">Função/Cargo Responsável de TI: </span>${escapeHtml(contatoCargo)}</div>
          <div class="info-line"><span class="label">Cidade: </span>${escapeHtml(buildCidadeCliente(relatorio))}</div>
        </div>
        <div class="info-row">
          <div class="info-line"><span class="label">Modalidade de atendimento: </span>${escapeHtml(fieldOrNA(relatorio.modalidadeServico))}</div>
          <div class="info-line"><span class="label">N° contrato: </span>${escapeHtml(fieldOrNA(relatorio.numeroContrato))}</div>
        </div>
        <div class="info-row">
          <div class="info-line"><span class="label">Técnico designado: </span>${escapeHtml(tecnicoNome)}</div>
          <div class="info-line"><span class="label">Data da visita: </span>${dataVisita ? escapeHtml(formatDatePdf(dataVisita)) : "N/A"}</div>
        </div>
      </div>

      <div class="section-title-wrap">
        <div class="section-title">Detalhamento dos Serviços</div>
      </div>
      <div class="services-body">
        ${setoresHtml}
        ${observacoesHtml}
      </div>
    </div>

    <div class="page-bottom-stack">
      <div class="highlight-card">
        <div class="highlight-title-wrap">
          <div class="highlight-title">Detalhamento de Horários</div>
        </div>
        <div class="highlight-body">${horariosHtml}</div>
      </div>

      <div class="highlight-card signatures-card">
        <div class="highlight-title-wrap">
          <div class="highlight-title">Assinatura dos Responsáveis</div>
        </div>
        <div class="highlight-body highlight-body-signatures">
          <div class="signatures">
            <div class="sign-col">
              <div class="sign-area"></div>
              <div class="sign-line"></div>
              <div class="sign-name">${escapeHtml(tecnicoNome)}</div>
              <div class="sign-hint">LINQ INFORMÁTICA</div>
            </div>
            <div class="sign-col">
              <div class="sign-area"></div>
              <div class="sign-line"></div>
              <div class="sign-name">${escapeHtml(responsavelCliente)}</div>
              <div class="sign-hint">${escapeHtml(clienteNome)}</div>
            </div>
          </div>
        </div>
      </div>

      <p class="legal-text">${escapeHtml(LEGAL_TEXT)}</p>
    </div>

    <footer class="footer">
      <div class="footer-left">${renderFooterLines(footer)}</div>
      <div class="footer-center">
        <div class="footer-web1">${escapeHtml(footer.websiteTitle)}</div>
        <div class="footer-web2">${escapeHtml(footer.websiteSubtitle)}</div>
      </div>
      <div class="footer-logo-wrap">${footerLogoImg}</div>
    </footer>
  </div>
</body>
</html>`;
  }

  async generatePdfBuffer(
    relatorio: RelatorioPdfData,
    config: PdfConfig,
  ): Promise<Buffer> {
    const logoDataUrl =
      config.logoDataUrl ??
      (config.logoStoragePath
        ? await resolveLogoDataUrl(config.logoStoragePath)
        : null);
    const html = this.buildHtml(relatorio, config, logoDataUrl);

    let browser: Awaited<ReturnType<typeof launchChromiumBrowser>> | undefined;

    try {
      browser = await launchChromiumBrowser();
      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      await page.evaluate(async () => {
        const images = Array.from(document.images);
        await Promise.all(
          images.map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete) {
                  resolve();
                  return;
                }
                img.addEventListener("load", () => resolve());
                img.addEventListener("error", () => resolve());
              }),
          ),
        );
      });

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "16px", right: "16px", bottom: "16px", left: "16px" },
      });

      return Buffer.from(pdf);
    } catch (error) {
      if (error instanceof RelatorioPdfUnavailableError) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Falha ao gerar PDF";
      throw new Error(message);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
