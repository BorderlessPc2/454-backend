import { PrismaClient } from "@prisma/client";
import type {
  CreateClienteDTO,
  UpdateClienteDTO,
  ClienteFilters,
} from "../types/dtos.js";

export class ClienteService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateClienteDTO) {
    const { contato, contrato, ...clienteData } = data;

    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: clienteData,
        include: {
          ramoAtividade: true,
        },
      });

      await tx.clienteContato.create({
        data: {
          clienteId: cliente.id,
          ...contato,
        },
      });

      await tx.contrato.create({
        data: {
          clienteId: cliente.id,
          ...contrato,
        },
      });

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

  async findAll(filters?: ClienteFilters) {
    const where: Record<string, unknown> = {};

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

  async findById(id: number) {
    return this.prisma.cliente.findFirst({
      where: { id },
      include: {
        ramoAtividade: true,
        contatos: true,
        contratos: true,
      },
    });
  }

  async update(id: number, data: UpdateClienteDTO) {
    const { contato, contrato, ...clienteData } = data;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.cliente.findFirst({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("Cliente não encontrado");
      }

      await tx.cliente.update({
        where: { id },
        data: clienteData,
      });

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

  async delete(id: number) {
    const existing = await this.prisma.cliente.findFirst({
      where: { id },
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
    data: {
      nome: string;
      cargo?: string;
      telefone?: string;
      email?: string;
      principal?: boolean;
    },
  ) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId },
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
    data: {
      nome?: string;
      cargo?: string;
      telefone?: string;
      email?: string;
      principal?: boolean;
    },
  ) {
    const contato = await this.prisma.clienteContato.findFirst({
      where: { id },
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

  async deleteContato(id: number) {
    const contato = await this.prisma.clienteContato.findFirst({
      where: { id },
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
