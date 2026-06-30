import type { Response } from "express";
import { DashboardKpisService } from "../services/dashboard-kpis.service.js";
import { parseDashboardPeriod } from "../lib/dashboard-period.js";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { resolveScopedUnidadeIdForRequest } from "../lib/scoped-unidade.js";
import type { DashboardKpisFilters } from "../types/dashboard-kpis.js";

const dashboardService = new DashboardKpisService(prisma);

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

function parseQueryInt(
  value: unknown,
  fieldName: string,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (value === undefined || (typeof value === "string" && value.trim() === "")) {
    return { ok: true, value: undefined };
  }
  const parsed = parsePositiveInt(value);
  if (parsed === undefined) {
    return { ok: false, error: `${fieldName} inválido` };
  }
  return { ok: true, value: parsed };
}

export class DashboardKpisController {
  static async getKpis(req: AuthRequest, res: Response): Promise<void> {
    try {
      const scope = resolveScopedUnidadeIdForRequest(req.user);
      if (!scope.ok) {
        res.status(403).json({ error: "Usuário sem unidade vinculada" });
        return;
      }

      const period = parseDashboardPeriod(
        typeof req.query["dataInicio"] === "string"
          ? req.query["dataInicio"]
          : undefined,
        typeof req.query["dataFim"] === "string"
          ? req.query["dataFim"]
          : undefined,
      );

      const unidadeParsed = parseQueryInt(req.query["unidadeId"], "unidadeId");
      if (!unidadeParsed.ok) {
        res.status(400).json({ error: unidadeParsed.error });
        return;
      }

      const tecnicoParsed = parseQueryInt(req.query["tecnicoId"], "tecnicoId");
      if (!tecnicoParsed.ok) {
        res.status(400).json({ error: tecnicoParsed.error });
        return;
      }

      const clienteParsed = parseQueryInt(req.query["clienteId"], "clienteId");
      if (!clienteParsed.ok) {
        res.status(400).json({ error: clienteParsed.error });
        return;
      }

      const setorParsed = parseQueryInt(req.query["setorId"], "setorId");
      if (!setorParsed.ok) {
        res.status(400).json({ error: setorParsed.error });
        return;
      }

      const isAdmin = req.user?.role === "ADMIN";

      if (!isAdmin) {
        if (
          unidadeParsed.value !== undefined ||
          tecnicoParsed.value !== undefined ||
          clienteParsed.value !== undefined
        ) {
          res.status(403).json({
            error:
              "Filtros unidadeId, tecnicoId e clienteId são exclusivos para ADMIN",
          });
          return;
        }
      }

      if (setorParsed.value !== undefined) {
        await dashboardService.assertSetorExists(setorParsed.value);
      }

      const filters: DashboardKpisFilters = {
        inicio: period.inicio,
        fim: period.fim,
        dataInicio: period.dataInicio,
        dataFim: period.dataFim,
        scopedUnidadeId: scope.scopedUnidadeId,
      };

      if (isAdmin) {
        if (unidadeParsed.value !== undefined) {
          filters.unidadeId = unidadeParsed.value;
        }
        if (clienteParsed.value !== undefined) {
          filters.clienteId = clienteParsed.value;
        }
        if (tecnicoParsed.value !== undefined) {
          filters.tecnicoNomeFilter = await dashboardService.resolveTecnicoNome(
            tecnicoParsed.value,
          );
        }
        if (setorParsed.value !== undefined) {
          filters.setorId = setorParsed.value;
        }

        const data = await dashboardService.getAdminKpis(filters);
        res.json(data);
        return;
      }

      const user = req.user;
      if (!user) {
        res.status(401).json({ error: "Não autenticado" });
        return;
      }

      filters.restrictToUserId = user.id;

      const tecnicoUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { nome: true },
      });

      if (!tecnicoUser?.nome?.trim()) {
        res.status(400).json({ error: "Usuário sem nome cadastrado" });
        return;
      }

      filters.restrictToUserNome = tecnicoUser.nome.trim();

      if (setorParsed.value !== undefined) {
        filters.setorId = setorParsed.value;
      }

      const data = await dashboardService.getTecnicoKpis(filters);
      res.json(data);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar KPIs do dashboard",
      });
    }
  }
}
