import type { PrismaClient } from "@prisma/client";
import { getSystemActivityLogClient } from "../lib/prisma-system-activity.js";
import {
  systemActivityLogger,
  type ActivityAction,
  type ActivityEntity,
  type SystemActivityLoggerInput,
} from "../lib/system-activity-logger.js";

export type ActivityLogFilters = {
  usuarioId?: number;
  entidade?: ActivityEntity;
  acao?: ActivityAction;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export class SystemActivityService {
  constructor(private prisma: PrismaClient) {}

  async log(input: SystemActivityLoggerInput) {
    return systemActivityLogger(this.prisma, input);
  }

  async findMany(filters: ActivityLogFilters = {}) {
    const page = Math.max(1, filters.page ?? DEFAULT_PAGE);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, filters.limit ?? DEFAULT_LIMIT),
    );
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.usuarioId !== undefined) {
      where.usuarioId = filters.usuarioId;
    }

    if (filters.entidade !== undefined) {
      where.entidade = filters.entidade;
    }

    if (filters.acao !== undefined) {
      where.acao = filters.acao;
    }

    if (filters.from !== undefined || filters.to !== undefined) {
      const timestamp: Record<string, Date> = {};
      if (filters.from !== undefined) {
        timestamp.gte = filters.from;
      }
      if (filters.to !== undefined) {
        timestamp.lte = filters.to;
      }
      where.timestamp = timestamp;
    }

    const activityClient = getSystemActivityLogClient(this.prisma);

    const [data, total] = await Promise.all([
      activityClient.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              username: true,
              role: true,
            },
          },
        },
      }),
      activityClient.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
