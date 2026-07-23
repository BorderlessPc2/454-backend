import type { Response } from "express";
import {
  RelatorioCalendarioService,
  RelatorioCalendarioStatusError,
} from "../services/relatorio-calendario.service.js";
import { CalendarioEventoService } from "../services/calendario-evento.service.js";
import { RelatorioForbiddenError } from "../services/relatorio.service.js";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { resolveScopedUnidadeIdForRequest } from "../lib/scoped-unidade.js";
import { serializeRelatorio } from "../lib/serialize-relatorio.js";
import type { CalendarioEventoFilters } from "../types/calendario-evento.js";
import type { ReagendarDataVisitaDTO } from "../types/relatorio-calendario.js";

const calendarioService = new RelatorioCalendarioService(prisma);
const calendarioEventoService = new CalendarioEventoService(prisma);

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

function parseDateParam(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export class RelatorioCalendarioController {
  /**
   * @deprecated Preferir `GET /calendario/eventos`.
   * Mantido como alias — lista eventos de organização (não relatórios).
   */
  static async listCalendario(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Não autenticado" });
        return;
      }

      const dataInicio = parseDateParam(req.query["dataInicio"]);
      const dataFim = parseDateParam(req.query["dataFim"]);

      if (!dataInicio) {
        res.status(400).json({
          error: "dataInicio é obrigatório (formato YYYY-MM-DD)",
        });
        return;
      }
      if (!dataFim) {
        res.status(400).json({
          error: "dataFim é obrigatório (formato YYYY-MM-DD)",
        });
        return;
      }

      const clienteId = parsePositiveInt(req.query["clienteId"]);
      if (clienteId === undefined && req.query["clienteId"] !== undefined) {
        res.status(400).json({ error: "clienteId inválido" });
        return;
      }

      const filters: CalendarioEventoFilters = { dataInicio, dataFim };
      if (clienteId !== undefined) filters.clienteId = clienteId;

      const eventos = await calendarioEventoService.list(filters);
      res.json(eventos);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao listar calendário",
      });
    }
  }

  static async reagendarDataVisita(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(401).json({ error: "Não autenticado" });
        return;
      }

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

      const body = req.body as ReagendarDataVisitaDTO;
      if (
        typeof body.dataVisita !== "string" ||
        body.dataVisita.trim() === ""
      ) {
        res.status(400).json({ error: "dataVisita é obrigatória" });
        return;
      }

      const result = await calendarioService.reagendarDataVisita(
        id,
        body.dataVisita,
        scope.scopedUnidadeId,
        req.user?.role,
        userId,
      );

      res.json({
        ...serializeRelatorio(result.relatorio),
        evento: result.evento,
      });
    } catch (error) {
      if (error instanceof RelatorioForbiddenError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof RelatorioCalendarioStatusError) {
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
            : "Erro ao reagendar data da visita",
      });
    }
  }

  /**
   * @deprecated Calendário não cria mais relatório.
   * Use `POST /calendario/eventos`.
   */
  static async createAgendamento(
    _req: AuthRequest,
    res: Response,
  ): Promise<void> {
    res.status(410).json({
      error:
        "Agendamento via relatório foi descontinuado. O calendário é só para organização da equipe e não cria relatório. Use POST /calendario/eventos com dataInicio e dataFim.",
      useInstead: "POST /calendario/eventos",
    });
  }
}
