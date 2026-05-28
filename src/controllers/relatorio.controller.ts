import type { Response } from "express";
import {
  RelatorioService,
  RelatorioForbiddenError,
} from "../services/relatorio.service.js";
import { prisma } from "../lib/prisma.js";
import type {
  CreateRelatorioDTO,
  UpdateRelatorioDTO,
  RelatorioFilters,
} from "../types/dtos.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { resolveScopedUnidadeIdForRequest } from "../lib/scoped-unidade.js";

const relatorioService = new RelatorioService(prisma);

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
      res.status(201).json(relatorio);
    } catch (error) {
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

      const relatorios = await relatorioService.findAll(
        filters,
        scopedUnidadeId,
        req.user?.role,
      );

      res.json(relatorios);
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

      const id = parseInt(req.params["id"] ?? "0");
      const relatorio = await relatorioService.findById(id, scopedUnidadeId);

      if (!relatorio) {
        res.status(404).json({ error: "Relatório não encontrado" });
        return;
      }

      res.json(relatorio);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar relatório" });
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
      res.json(relatorio);
    } catch (error) {
      if (error instanceof RelatorioForbiddenError) {
        res.status(403).json({ error: error.message });
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

      const id = parseInt(req.params["id"] ?? "0");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      const relatorio = await relatorioService.getRelatorioParaPdf(
        id,
        scopedUnidadeId,
      );
      res.json(relatorio);
    } catch (error) {
      console.error("Erro ao carregar relatório para o frontend:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar relatório",
      });
    }
  }
}
