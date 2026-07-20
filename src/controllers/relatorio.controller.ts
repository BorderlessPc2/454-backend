import type { Response } from "express";
import {
  RelatorioService,
  RelatorioForbiddenError,
  RelatorioStatusTransitionError,
} from "../services/relatorio.service.js";
import {
  RelatorioPdfService,
  RelatorioPdfUnavailableError,
} from "../services/relatorio-pdf.service.js";
import { EmailService } from "../services/email.service.js";
import { configuracaoService } from "../lib/configuracao-service.singleton.js";
import { prisma } from "../lib/prisma.js";
import type {
  CreateRelatorioDTO,
  UpdateRelatorioDTO,
  RelatorioFilters,
} from "../types/dtos.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { resolveScopedUnidadeIdForRequest } from "../lib/scoped-unidade.js";
import { loadPdfBranding } from "../lib/pdf-branding.js";
import { normalizeRelatorioForPdf } from "../lib/normalize-relatorio-for-pdf.js";
import {
  serializeRelatorio,
  serializeRelatorios,
} from "../lib/serialize-relatorio.js";
import { pdfLogoDebug } from "../lib/pdf-logo-debug.js";
import { parseStatusFilter } from "../lib/relatorio-status.js";

const relatorioService = new RelatorioService(prisma);
const relatorioPdfService = new RelatorioPdfService();
const emailService = new EmailService();

export class RelatorioController {
  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(403).json({ error: "Usuário sem unidade vinculada" });
        return;
      }
      const { scopedUnidadeId } = scope;

      const data: CreateRelatorioDTO = req.body;
      const criadoPorId = req.user?.id ?? 0;
      const relatorio = await relatorioService.create(
        data,
        criadoPorId,
        scopedUnidadeId,
      );
      res.status(201).json(serializeRelatorio(relatorio));
    } catch (error) {
      if (error instanceof RelatorioStatusTransitionError) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao criar relatório",
      });
    }
  }

  static async findAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(403).json({ error: "Usuário sem unidade vinculada" });
        return;
      }
      const { scopedUnidadeId } = scope;

      const filters: RelatorioFilters = {};

      const clienteId = req.query["clienteId"];
      if (typeof clienteId === "string" && !isNaN(Number(clienteId))) {
        filters.clienteId = Number(clienteId);
      }

      const criadoPorId = req.query["criadoPorId"];
      if (typeof criadoPorId === "string" && !isNaN(Number(criadoPorId))) {
        filters.criadoPorId = Number(criadoPorId);
      }

      const dataInicio = req.query["dataInicio"];
      if (typeof dataInicio === "string" && dataInicio.trim() !== "") {
        filters.dataInicio = dataInicio;
      }

      const dataFim = req.query["dataFim"];
      if (typeof dataFim === "string" && dataFim.trim() !== "") {
        filters.dataFim = dataFim;
      }

      const impresso = req.query["impresso"];
      if (impresso === "true") {
        filters.impresso = true;
      } else if (impresso === "false") {
        filters.impresso = false;
      }

      try {
        const statusFilter = parseStatusFilter(req.query["status"]);
        if (statusFilter !== undefined) {
          filters.status = statusFilter;
        }
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error ? error.message : "Filtro status inválido",
        });
        return;
      }

      const relatorios = await relatorioService.findAll(
        filters,
        scopedUnidadeId,
        req.user?.role,
      );

      res.json(serializeRelatorios(relatorios));
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao buscar relatórios",
      });
    }
  }

  static async findById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(403).json({ error: "Usuário sem unidade vinculada" });
        return;
      }
      const { scopedUnidadeId } = scope;

      const id = parseInt(req.params["id"] ?? "0", 10);
      if (Number.isNaN(id) || id <= 0) {
        res.status(404).json({ error: "Relatório não encontrado" });
        return;
      }

      const relatorio = await relatorioService.findById(id, scopedUnidadeId);

      if (!relatorio) {
        res.status(404).json({ error: "Relatório não encontrado" });
        return;
      }

      res.json(serializeRelatorio(relatorio));
    } catch (error) {
      console.error("[relatorios.findById]", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Erro ao buscar relatório",
      });
    }
  }

  static async findAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(403).json({ error: "Usuário sem unidade vinculada" });
        return;
      }
      const { scopedUnidadeId } = scope;

      const id = parseInt(req.params["id"] ?? "0");
      const logs = await relatorioService.findAuditLogsByRelatorioId(
        id,
        scopedUnidadeId,
      );

      if (logs === null) {
        res.status(404).json({ error: "Relatório não encontrado" });
        return;
      }

      res.json(logs);
    } catch {
      res.status(500).json({ error: "Erro ao buscar histórico de auditoria" });
    }
  }

  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(403).json({ error: "Usuário sem unidade vinculada" });
        return;
      }
      const { scopedUnidadeId } = scope;

      const id = parseInt(req.params["id"] ?? "0");
      const userId = req.user?.id;
      if (userId === undefined) {
        res.status(401).json({ error: "Não autenticado" });
        return;
      }
      const data: UpdateRelatorioDTO = req.body;
      const relatorio = await relatorioService.update(
        id,
        data,
        scopedUnidadeId,
        req.user?.role,
        userId,
      );
      if (!relatorio) {
        res.status(404).json({ error: "Relatório não encontrado" });
        return;
      }
      res.json(serializeRelatorio(relatorio));
    } catch (error) {
      if (error instanceof RelatorioForbiddenError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof RelatorioStatusTransitionError) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar relatório",
      });
    }
  }

  static async updateStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(403).json({ error: "Usuário sem unidade vinculada" });
        return;
      }
      const { scopedUnidadeId } = scope;

      const id = parseInt(req.params["id"] ?? "0", 10);
      if (Number.isNaN(id) || id <= 0) {
        res.status(400).json({ error: "ID inválido" });
        return;
      }

      const userId = req.user?.id;
      if (userId === undefined) {
        res.status(401).json({ error: "Não autenticado" });
        return;
      }

      const body = req.body as { status?: unknown };
      const result = await relatorioService.updateStatus(
        id,
        body.status,
        scopedUnidadeId,
        req.user?.role,
        userId,
      );

      res.json({
        ...serializeRelatorio(result.relatorio),
        statusAnterior: result.statusAnterior,
        statusAtual: result.statusAtual,
        transicoesPermitidas: result.transicoesPermitidas,
      });
    } catch (error) {
      if (error instanceof RelatorioForbiddenError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof RelatorioStatusTransitionError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (
        error instanceof Error &&
        error.message === "Relatório não encontrado"
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar status do relatório",
      });
    }
  }

  static async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(403).json({ error: "Usuário sem unidade vinculada" });
        return;
      }
      const { scopedUnidadeId } = scope;

      const id = parseInt(req.params["id"] ?? "0");
      const userId = req.user?.id;
      if (userId === undefined) {
        res.status(401).json({ error: "Não autenticado" });
        return;
      }
      await relatorioService.delete(
        id,
        scopedUnidadeId,
        req.user?.role,
        userId,
      );
      res.status(204).send();
    } catch (error) {
      if (error instanceof RelatorioForbiddenError) {
        res.status(403).json({ error: error.message });
        return;
      }
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao deletar relatório",
      });
    }
  }

  static async getRelatorioParaPdf(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(403).json({ error: "Usuário sem unidade vinculada" });
        return;
      }
      const { scopedUnidadeId } = scope;

      const id = parseInt(req.params["id"] ?? "0", 10);
      if (Number.isNaN(id) || id <= 0) {
        res.status(400).json({ error: "ID inválido" });
        return;
      }

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      const [relatorio, pdfConfig] = await Promise.all([
        relatorioService.getRelatorioParaPdf(id, scopedUnidadeId),
        loadPdfBranding(configuracaoService),
      ]);

      res.json({
        ...serializeRelatorio(relatorio),
        pdfConfig: {
          logoUrl: pdfConfig.logoUrl,
          logoDataUrl: pdfConfig.logoDataUrl,
          textoRodapeRelatorio: pdfConfig.textoRodapeRelatorio,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Relatório não encontrado"
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      console.error("Erro ao carregar relatório para o frontend:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar relatório",
      });
    }
  }

  static async downloadPdfFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(403).json({ error: "Usuário sem unidade vinculada" });
        return;
      }
      const { scopedUnidadeId } = scope;

      const id = parseInt(req.params["id"] ?? "0", 10);
      if (Number.isNaN(id) || id <= 0) {
        res.status(400).json({ error: "ID inválido" });
        return;
      }

      const [relatorio, branding] = await Promise.all([
        relatorioService.getRelatorioParaPdf(id, scopedUnidadeId),
        loadPdfBranding(configuracaoService),
      ]);

      if (branding.logoStoragePath && !branding.logoDataUrl) {
        console.warn(
          "[pdf] Logo configurado mas não foi possível carregar para o PDF:",
          branding.logoStoragePath,
          "rawLogoUrl:",
          branding.rawLogoUrl,
          "publicUrl:",
          branding.logoUrl,
        );
      }

      pdfLogoDebug("downloadPdfFile branding", {
        logoStoragePath: branding.logoStoragePath,
        rawLogoUrl: branding.rawLogoUrl,
        publicLogoUrl: branding.logoUrl,
        logoDataUrlPresent: Boolean(branding.logoDataUrl),
        logoDataUrlLength: branding.logoDataUrl?.length ?? 0,
      });

      const buffer = await relatorioPdfService.generatePdfBuffer(
        normalizeRelatorioForPdf(relatorio),
        {
          logoStoragePath: branding.logoStoragePath,
          logoUrl: branding.rawLogoUrl,
          logoDataUrl: branding.logoDataUrl,
          textoRodapeRelatorio: branding.textoRodapeRelatorio,
        },
      );

      const filename = `Relatório Técnico - ${relatorio.id}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Cache-Control", "no-store");
      res.send(buffer);
    } catch (error) {
      if (error instanceof RelatorioPdfUnavailableError) {
        res.status(503).json({ error: error.message });
        return;
      }
      if (
        error instanceof Error &&
        error.message === "Relatório não encontrado"
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      console.error("Erro ao gerar PDF do relatório:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Falha ao gerar PDF",
      });
    }
  }

  static async enviarEmail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(403).json({ error: "Usuário sem unidade vinculada" });
        return;
      }
      const { scopedUnidadeId } = scope;

      const id = parseInt(req.params["id"] ?? "0", 10);
      if (Number.isNaN(id) || id <= 0) {
        res.status(400).json({ error: "ID inválido" });
        return;
      }

      const [relatorio, branding] = await Promise.all([
        relatorioService.getRelatorioParaPdf(id, scopedUnidadeId),
        loadPdfBranding(configuracaoService),
      ]);

      const to = relatorio.contato?.email?.trim();
      if (!to) {
        res.status(400).json({
          error: "Contato do relatório sem e-mail cadastrado",
        });
        return;
      }

      const buffer = await relatorioPdfService.generatePdfBuffer(
        normalizeRelatorioForPdf(relatorio),
        {
          logoStoragePath: branding.logoStoragePath,
          logoUrl: branding.rawLogoUrl,
          logoDataUrl: branding.logoDataUrl,
          textoRodapeRelatorio: branding.textoRodapeRelatorio,
        },
      );

      const clienteNome =
        relatorio.cliente.nomeFantasia?.trim() ||
        relatorio.cliente.razaoSocial;

      await emailService.sendRelatorioPdf({
        to,
        clienteNome,
        relatorioId: relatorio.id,
        pdfBuffer: buffer,
      });

      res.json({ message: "Relatório enviado por e-mail com sucesso" });
    } catch (error) {
      if (error instanceof RelatorioPdfUnavailableError) {
        res.status(503).json({ error: error.message });
        return;
      }
      if (
        error instanceof Error &&
        error.message === "Relatório não encontrado"
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      console.error("Erro ao enviar relatório por e-mail:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Falha ao enviar relatório por e-mail",
      });
    }
  }
}
