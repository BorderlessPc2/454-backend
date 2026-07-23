import type { Response } from "express";
import {
  RelatorioGerencialService,
} from "../services/relatorio-gerencial.service.js";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { resolveScopedUnidadeIdForRequest } from "../lib/scoped-unidade.js";
import { buildRelatorioGerencialWorkbook } from "../lib/relatorio-gerencial-xlsx.js";
import type {
  RelatorioGerencialFilters,
  RelatorioGerencialFormato,
  RelatorioGerencialTipo,
} from "../types/relatorio-gerencial.js";

const gerencialService = new RelatorioGerencialService(prisma);

const TIPOS_VALIDOS: RelatorioGerencialTipo[] = [
  "resumo-cliente",
  "produtividade-tecnico",
  "sla-contratos",
];

const TIPOS_ADMIN_ONLY: RelatorioGerencialTipo[] = [
  "produtividade-tecnico",
  "sla-contratos",
];

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}

function parseTipo(value: unknown): RelatorioGerencialTipo | null {
  if (typeof value !== "string") {
    return null;
  }
  return TIPOS_VALIDOS.includes(value as RelatorioGerencialTipo)
    ? (value as RelatorioGerencialTipo)
    : null;
}

function parseFormato(value: unknown): RelatorioGerencialFormato {
  if (value === "xlsx") {
    return "xlsx";
  }
  return "json";
}

export class RelatorioGerencialController {
  static async get(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(401).json({ error: "Não autenticado" });
        return;
      }

      const tipo = parseTipo(req.query["tipo"]);
      if (!tipo) {
        res.status(400).json({
          error:
            "tipo inválido: use resumo-cliente, produtividade-tecnico ou sla-contratos",
        });
        return;
      }

      const periodoRaw = req.query["periodo"];
      if (typeof periodoRaw !== "string" || periodoRaw.trim() === "") {
        res.status(400).json({
          error: "periodo é obrigatório (formato YYYY-MM, ex.: 2025-01)",
        });
        return;
      }

      if (
        req.user?.role === "TECNICO" &&
        TIPOS_ADMIN_ONLY.includes(tipo)
      ) {
        res.status(403).json({
          error: "Acesso negado: relatório disponível apenas para ADMIN",
        });
        return;
      }

      const clienteId = parsePositiveInt(req.query["clienteId"]);
      const tecnicoId = parsePositiveInt(req.query["tecnicoId"]);
      const unidadeIdQuery = parsePositiveInt(req.query["unidadeId"]);

      if (clienteId === undefined && req.query["clienteId"] !== undefined) {
        res.status(400).json({ error: "clienteId inválido" });
        return;
      }
      if (tecnicoId === undefined && req.query["tecnicoId"] !== undefined) {
        res.status(400).json({ error: "tecnicoId inválido" });
        return;
      }
      if (
        unidadeIdQuery === undefined &&
        req.query["unidadeId"] !== undefined
      ) {
        res.status(400).json({ error: "unidadeId inválido" });
        return;
      }

      if (req.user?.role === "TECNICO" && unidadeIdQuery !== undefined) {
        res.status(403).json({
          error: "Técnico não pode filtrar por unidadeId",
        });
        return;
      }

      const filters: RelatorioGerencialFilters = {
        periodo: periodoRaw.trim(),
        scopedUnidadeId: scope.scopedUnidadeId,
      };

      if (clienteId !== undefined) {
        filters.clienteId = clienteId;
      }
      if (tecnicoId !== undefined) {
        filters.tecnicoId = tecnicoId;
      }
      if (
        req.user?.role === "ADMIN" &&
        unidadeIdQuery !== undefined
      ) {
        filters.unidadeId = unidadeIdQuery;
      }

      const formato = parseFormato(req.query["formato"]);
      const data = await gerencialService.getByTipo(tipo, filters);

      if (formato === "xlsx") {
        const buffer = await buildRelatorioGerencialWorkbook(data);
        const filename = `relatorio-gerencial-${tipo}-${filters.periodo}.xlsx`;
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
        res.setHeader("Cache-Control", "no-store");
        res.send(buffer);
        return;
      }

      res.json(data);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao gerar relatório gerencial",
      });
    }
  }
}
