import type { Response } from "express";
import { ClienteService } from "../services/cliente.service.js";
import { prisma } from "../lib/prisma.js";
import type {
  CreateClienteDTO,
  UpdateClienteDTO,
  ClienteFilters,
} from "../types/dtos.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

const clienteService = new ClienteService(prisma);

export class ClienteController {
  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data: CreateClienteDTO = req.body;
      const cliente = await clienteService.create(data);
      res.status(201).json(cliente);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Erro ao criar cliente",
      });
    }
  }

  static async findAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filters: ClienteFilters = {};

      const nomeFantasia = req.query["nomeFantasia"];
      if (typeof nomeFantasia === "string" && nomeFantasia.trim() !== "") {
        filters.nomeFantasia = nomeFantasia;
      }

      const cnpj = req.query["cnpj"];
      if (typeof cnpj === "string" && cnpj.trim() !== "") {
        filters.cnpj = cnpj;
      }

      const ramoAtividadeId = req.query["ramoAtividadeId"];
      if (
        typeof ramoAtividadeId === "string" &&
        !isNaN(Number(ramoAtividadeId))
      ) {
        filters.ramoAtividadeId = Number(ramoAtividadeId);
      }

      const clientes = await clienteService.findAll(filters);

      res.json(clientes);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar clientes" });
    }
  }

  static async findById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params["id"] ?? "0");
      const cliente = await clienteService.findById(id);

      if (!cliente) {
        res.status(404).json({ error: "Cliente não encontrado" });
        return;
      }

      res.json(cliente);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar cliente" });
    }
  }

  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params["id"] ?? "0");
      const data: UpdateClienteDTO = req.body;
      const cliente = await clienteService.update(id, data);
      res.json(cliente);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao atualizar cliente",
      });
    }
  }

  static async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params["id"] ?? "0");
      await clienteService.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao deletar cliente",
      });
    }
  }

  static async createContato(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = parseInt(req.params["id"] ?? "0");
      const data = req.body;
      const contato = await clienteService.createContato(clienteId, data);
      res.status(201).json(contato);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Erro ao criar contato",
      });
    }
  }

  static async updateContato(req: AuthRequest, res: Response): Promise<void> {
    try {
      const contatoId = parseInt(req.params["contatoId"] ?? "0");
      const data = req.body;
      const contato = await clienteService.updateContato(contatoId, data);
      res.json(contato);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao atualizar contato",
      });
    }
  }

  static async deleteContato(req: AuthRequest, res: Response): Promise<void> {
    try {
      const contatoId = parseInt(req.params["contatoId"] ?? "0");
      await clienteService.deleteContato(contatoId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Erro ao deletar contato",
      });
    }
  }
}
