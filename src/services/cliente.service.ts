import { PrismaClient } from "@prisma/client";
import type {
  CreateClienteDTO,
  UpdateClienteDTO,
  ClienteFilters,
} from "../types/dtos.js";

export class ClienteService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateClienteDTO, scopedUnidadeId: number | null) {
    const { contato, contrato, unidadeId: dtoUnidadeId, ...clienteData } = data;
    const resolvedUnidade =
      scopedUnidadeId ??
      (typeof dtoUnidadeId === "number" && Number.isFinite(dtoUnidadeId)
        ? dtoUnidadeId
        : null);

    if (resolvedUnidade === null) {
      throw new Error("unidadeId é obrigatório para criar cliente");
    }

    const unidadeId = Number(resolvedUnidade);

    return this.prisma.$transaction(async (tx) => {
      // Criar cliente
      const cliente = await tx.cliente.create({
        data: {
          ...clienteData,
          unidadeId,
        },
        include: {
          ramoAtividade: true,
        },
      });

      // Criar contato associado
      await tx.clienteContato.create({
        data: {
          clienteId: cliente.id,
          ...contato,
        },
      });

      // Criar contrato associado
      await tx.contrato.create({
        data: {
          clienteId: cliente.id,
          ...contrato,
        },
      });

      // Retornar cliente com as relações
      return tx.cliente.findUnique({
        where: { id: cliente.id },
        include: {
          ramoAtividade: true,
          contatos: true,
          contratos: true,
        },
      });
    });
  }

  async findAll(scopedUnidadeId: number | null, filters?: ClienteFilters) {
    const where: Record<string, unknown> = {};
    if (scopedUnidadeId !== null) {
      where.unidadeId = scopedUnidadeId;
    }

    if (filters?.nomeFantasia) {
      where.nomeFantasia = {
        contains: filters.nomeFantasia,
        mode: "insensitive",
      };
    }

    if (filters?.cnpj) {
      where.cnpj = { contains: filters.cnpj };
    }

    if (filters?.ramoAtividadeId) {
      where.ramoAtividadeId = filters.ramoAtividadeId;
    }

    return this.prisma.cliente.findMany({
      where,
      include: {
        ramoAtividade: true,
        contatos: true,
        contratos: true,
      },
      orderBy: { nomeFantasia: "asc" },
    });
  }

  async findById(id: number, scopedUnidadeId: number | null) {
    return this.prisma.cliente.findFirst({
      where:
        scopedUnidadeId === null ? { id } : { id, unidadeId: scopedUnidadeId },
      include: {
        ramoAtividade: true,
        contatos: true,
        contratos: true,
      },
    });
  }

  async update(id: number, data: UpdateClienteDTO, scopedUnidadeId: number | null) {
    const { contato, contrato, ...clienteData } = data;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.cliente.findFirst({
        where:
          scopedUnidadeId === null
            ? { id }
            : { id, unidadeId: scopedUnidadeId },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("Cliente não encontrado");
      }

      // Atualizar cliente
      const cliente = await tx.cliente.update({
        where: { id },
        data: clienteData,
      });

      // Atualizar contato se fornecido
      if (contato) {
        const contatoExistente = await tx.clienteContato.findFirst({
          where: { clienteId: id },
        });

        if (contatoExistente) {
          await tx.clienteContato.update({
            where: { id: contatoExistente.id },
            data: contato,
          });
        }
      }

      // Atualizar contrato se fornecido
      if (contrato) {
        const contratoExistente = await tx.contrato.findFirst({
          where: { clienteId: id },
        });

        if (contratoExistente) {
          await tx.contrato.update({
            where: { id: contratoExistente.id },
            data: contrato,
          });
        }
      }

      // Retornar cliente com as relações
      return tx.cliente.findUnique({
        where: { id },
        include: {
          ramoAtividade: true,
          contatos: true,
          contratos: true,
        },
      });
    });
  }

  async delete(id: number, scopedUnidadeId: number | null) {
    const existing = await this.prisma.cliente.findFirst({
      where:
        scopedUnidadeId === null
          ? { id }
          : { id, unidadeId: scopedUnidadeId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Cliente não encontrado");
    }

    return this.prisma.cliente.delete({
      where: { id },
    });
  }

  async createContato(
    clienteId: number,
    scopedUnidadeId: number | null,
    data: {
      nome: string;
      cargo?: string;
      telefone?: string;
      email?: string;
      principal?: boolean;
    },
  ) {
    const cliente = await this.prisma.cliente.findFirst({
      where:
        scopedUnidadeId === null
          ? { id: clienteId }
          : { id: clienteId, unidadeId: scopedUnidadeId },
      select: { id: true },
    });

    if (!cliente) {
      throw new Error("Cliente não encontrado");
    }

    return this.prisma.clienteContato.create({
      data: {
        ...data,
        clienteId,
      },
    });
  }

  async updateContato(
    id: number,
    scopedUnidadeId: number | null,
    data: {
      nome?: string;
      cargo?: string;
      telefone?: string;
      email?: string;
      principal?: boolean;
    },
  ) {
    const contato = await this.prisma.clienteContato.findFirst({
      where:
        scopedUnidadeId === null
          ? { id }
          : { id, cliente: { unidadeId: scopedUnidadeId } },
      select: { id: true },
    });

    if (!contato) {
      throw new Error("Contato não encontrado");
    }

    return this.prisma.clienteContato.update({
      where: { id },
      data,
    });
  }

  async deleteContato(id: number, scopedUnidadeId: number | null) {
    const contato = await this.prisma.clienteContato.findFirst({
      where:
        scopedUnidadeId === null
          ? { id }
          : { id, cliente: { unidadeId: scopedUnidadeId } },
      select: { id: true },
    });

    if (!contato) {
      throw new Error("Contato não encontrado");
    }

    return this.prisma.clienteContato.delete({
      where: { id },
    });
  }
}
