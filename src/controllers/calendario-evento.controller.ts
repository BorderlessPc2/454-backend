import type { Response } from "express";
import { CalendarioEventoService } from "../services/calendario-evento.service.js";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import type {
  CalendarioEventoFilters,
  CreateCalendarioEventoDTO,
  UpdateCalendarioEventoDTO,
} from "../types/calendario-evento.js";

const calendarioService = new CalendarioEventoService(prisma);

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

function requireUser(req: AuthRequest, res: Response): req is AuthRequest & {
  user: NonNullable<AuthRequest["user"]>;
} {
  if (!req.user) {
    res.status(401).json({ error: "Não autenticado" });
    return false;
  }
  return true;
}

export class CalendarioEventoController {
  static async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!requireUser(req, res)) return;

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
      const criadoPorId = parsePositiveInt(req.query["criadoPorId"]);

      if (clienteId === undefined && req.query["clienteId"] !== undefined) {
        res.status(400).json({ error: "clienteId inválido" });
        return;
      }
      if (criadoPorId === undefined && req.query["criadoPorId"] !== undefined) {
        res.status(400).json({ error: "criadoPorId inválido" });
        return;
      }

      const filters: CalendarioEventoFilters = { dataInicio, dataFim };
      if (clienteId !== undefined) filters.clienteId = clienteId;
      if (criadoPorId !== undefined) filters.criadoPorId = criadoPorId;

      const eventos = await calendarioService.list(filters);
      res.json(eventos);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao listar eventos",
      });
    }
  }

  static async findById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!requireUser(req, res)) return;

      const id = Number(req.params["id"]);
      const evento = await calendarioService.findById(id);
      if (!evento) {
        res.status(404).json({ error: "Evento não encontrado" });
        return;
      }
      res.json(evento);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao buscar evento",
      });
    }
  }

  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!requireUser(req, res)) return;

      const body = req.body as Record<string, unknown>;
      const data: CreateCalendarioEventoDTO = {
        titulo: typeof body.titulo === "string" ? body.titulo : "",
        dataInicio:
          typeof body.dataInicio === "string" ? body.dataInicio : "",
        dataFim: typeof body.dataFim === "string" ? body.dataFim : "",
      };

      if (body.descricao !== undefined) {
        data.descricao =
          body.descricao === null ? null : String(body.descricao);
      }
      if (body.clienteId !== undefined) {
        if (body.clienteId === null) {
          data.clienteId = null;
        } else {
          const n = Number(body.clienteId);
          if (!Number.isInteger(n) || n < 1) {
            res.status(400).json({ error: "clienteId inválido" });
            return;
          }
          data.clienteId = n;
        }
      }

      const evento = await calendarioService.create(data, req.user.id);
      res.status(201).json(evento);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao criar evento",
      });
    }
  }

  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!requireUser(req, res)) return;

      const id = Number(req.params["id"]);
      const body = req.body as Record<string, unknown>;
      const data: UpdateCalendarioEventoDTO = {};

      if (body.titulo !== undefined) {
        data.titulo = typeof body.titulo === "string" ? body.titulo : "";
      }
      if (body.descricao !== undefined) {
        data.descricao =
          body.descricao === null ? null : String(body.descricao);
      }
      if (body.dataInicio !== undefined) {
        data.dataInicio =
          typeof body.dataInicio === "string" ? body.dataInicio : "";
      }
      if (body.dataFim !== undefined) {
        data.dataFim = typeof body.dataFim === "string" ? body.dataFim : "";
      }
      if (body.clienteId !== undefined) {
        if (body.clienteId === null) {
          data.clienteId = null;
        } else {
          const n = Number(body.clienteId);
          if (!Number.isInteger(n) || n < 1) {
            res.status(400).json({ error: "clienteId inválido" });
            return;
          }
          data.clienteId = n;
        }
      }

      const evento = await calendarioService.update(id, data, {
        id: req.user.id,
        role: req.user.role,
      });
      res.json(evento);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao atualizar evento";
      const status =
        message.includes("permissão") ? 403
        : message.includes("não encontrado") ? 404
        : 400;
      res.status(status).json({ error: message });
    }
  }

  static async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!requireUser(req, res)) return;

      const id = Number(req.params["id"]);
      await calendarioService.delete(id, {
        id: req.user.id,
        role: req.user.role,
      });
      res.status(204).send();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao excluir evento";
      const status =
        message.includes("permissão") ? 403
        : message.includes("não encontrado") ? 404
        : 400;
      res.status(status).json({ error: message });
    }
  }
}
