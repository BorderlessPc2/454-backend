import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITIES,
  type ActivityAction,
  type ActivityEntity,
} from "../lib/system-activity-logger.js";
import { SystemActivityService } from "../services/system-activity.service.js";

const systemActivityService = new SystemActivityService(prisma);

const VALID_ENTITIES = new Set<string>(ACTIVITY_ENTITIES);
const VALID_ACTIONS = new Set<string>(ACTIVITY_ACTIONS);

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export class SystemActivityController {
  static async findAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const usuarioId = parsePositiveInt(req.query["usuarioId"]);
      const page = parsePositiveInt(req.query["page"]);
      const limit = parsePositiveInt(req.query["limit"]);
      const from = parseDate(req.query["from"]);
      const to = parseDate(req.query["to"]);

      const entidadeRaw = req.query["entidade"];
      const acaoRaw = req.query["acao"];

      let entidade: ActivityEntity | undefined;
      if (typeof entidadeRaw === "string" && VALID_ENTITIES.has(entidadeRaw)) {
        entidade = entidadeRaw as ActivityEntity;
      }

      let acao: ActivityAction | undefined;
      if (typeof acaoRaw === "string" && VALID_ACTIONS.has(acaoRaw)) {
        acao = acaoRaw as ActivityAction;
      }

      const filters: {
        usuarioId?: number;
        entidade?: ActivityEntity;
        acao?: ActivityAction;
        from?: Date;
        to?: Date;
        page?: number;
        limit?: number;
      } = {};

      if (usuarioId !== undefined) filters.usuarioId = usuarioId;
      if (entidade !== undefined) filters.entidade = entidade;
      if (acao !== undefined) filters.acao = acao;
      if (from !== undefined) filters.from = from;
      if (to !== undefined) filters.to = to;
      if (page !== undefined) filters.page = page;
      if (limit !== undefined) filters.limit = limit;

      const result = await systemActivityService.findMany(filters);

      res.json(result);
    } catch {
      res.status(500).json({ error: "Erro ao buscar logs de atividade" });
    }
  }
}
