import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { LoginDTO, CreateUserDTO, UpdateUserDTO } from "../types/dtos.js";
import { getJwtSecret } from "../lib/jwt-secret.js";
/** Ex.: `8h`, `12h`, `1d` — ver documentação jsonwebtoken. */
const JWT_EXPIRES_IN_RAW = (
  process.env["JWT_EXPIRES_IN"] ?? "8h"
).trim();
const JWT_EXPIRES_IN = JWT_EXPIRES_IN_RAW !== "" ? JWT_EXPIRES_IN_RAW : "8h";
const SALT_ROUNDS = 10;

/** Latência mínima na falha de login para reduzir enumeração por tempo. */
const CREDENTIAL_FAILURE_MIN_LATENCY_MS = 500;

async function delayUntilMinimumElapsed(
  startedAtMs: number,
  minimumMs: number,
): Promise<void> {
  const remaining = minimumMs - (Date.now() - startedAtMs);
  if (remaining > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, remaining);
    });
  }
}

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  private async resolveUnidadeIdFromCliente(
    clienteId: number | undefined,
  ): Promise<number | null> {
    if (clienteId === undefined) {
      return null;
    }

    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { unidadeId: true },
    });

    if (!cliente) {
      throw new Error("Cliente não encontrado");
    }

    return cliente.unidadeId;
  }

  /**
   * TECNICO: unidade via cliente OU unidadeId explícito (obrigatório um dos dois).
   * Se ambos forem enviados, devem ser coerentes.
   */
  private async resolveUnidadeIdForTecnicoOnCreate(
    data: CreateUserDTO,
  ): Promise<number> {
    if (data.clienteId !== undefined) {
      const fromCliente = await this.resolveUnidadeIdFromCliente(
        data.clienteId,
      );
      if (fromCliente == null) {
        throw new Error("Cliente não encontrado");
      }
      if (
        data.unidadeId !== undefined &&
        data.unidadeId !== fromCliente
      ) {
        throw new Error(
          "unidadeId informado não corresponde à unidade do cliente",
        );
      }
      return fromCliente;
    }

    if (
      data.unidadeId === undefined ||
      typeof data.unidadeId !== "number" ||
      !Number.isInteger(data.unidadeId) ||
      data.unidadeId < 1
    ) {
      throw new Error(
        "Técnico deve ter unidadeId no cadastro ou estar vinculado a um cliente",
      );
    }

    return data.unidadeId;
  }

  async login(data: LoginDTO): Promise<{
    token: string;
    user: {
      id: number;
      username: string;
      nome: string;
      role: string;
      clienteId: number | null;
      unidadeId: number | null;
    };
  }> {
    const email =
      (typeof data.email === "string" ? data.email.trim() : "") ||
      (typeof data.username === "string" ? data.username.trim() : "");

    if (!email) {
      throw new Error("Email não fornecido");
    }

    if (data.password == null || String(data.password).trim() === "") {
      throw new Error("Senha não fornecida");
    }

    const credentialCheckStartedAt = Date.now();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username: email }],
      },
    });

    if (!user || !user.ativo) {
      await delayUntilMinimumElapsed(
        credentialCheckStartedAt,
        CREDENTIAL_FAILURE_MIN_LATENCY_MS,
      );
      throw new Error("Credenciais inválidas");
    }

    const valid = await bcrypt.compare(String(data.password), user.password);

    if (!valid) {
      await delayUntilMinimumElapsed(
        credentialCheckStartedAt,
        CREDENTIAL_FAILURE_MIN_LATENCY_MS,
      );
      throw new Error("Credenciais inválidas");
    }

    const signOpts = {
      expiresIn: JWT_EXPIRES_IN,
    } as SignOptions;
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        clienteId: user.clienteId,
        unidadeId: user.unidadeId,
      },
      getJwtSecret(),
      signOpts,
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        nome: user.nome,
        role: user.role,
        clienteId: user.clienteId,
        unidadeId: user.unidadeId,
      },
    };
  }

  async createUser(data: CreateUserDTO) {
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    const userData: Prisma.UserUncheckedCreateInput = {
      username: data.username,
      password: hashedPassword,
      nome: data.nome,
      email: data.email,
      role: data.role,
    };

    if (data.clienteId !== undefined) {
      userData.clienteId = data.clienteId;
    }

    userData.unidadeId =
      data.role === "TECNICO"
        ? await this.resolveUnidadeIdForTecnicoOnCreate(data)
        : await this.resolveUnidadeIdFromCliente(data.clienteId);

    return this.prisma.user.create({
      data: userData,
      select: {
        id: true,
        username: true,
        nome: true,
        email: true,
        role: true,
        clienteId: true,
        unidadeId: true,
        ativo: true,
        createdAt: true,
      },
    });
  }

  async getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        nome: true,
        email: true,
        role: true,
        clienteId: true,
        unidadeId: true,
        ativo: true,
        createdAt: true,
      },
    });
  }
  async getUsersTecnico() {
    return this.prisma.user.findMany({
      where: { role: "TECNICO" },
      select: {
        id: true,
        username: true,
        nome: true,
        email: true,
        role: true,
        clienteId: true,
        unidadeId: true,
        ativo: true,
        createdAt: true,
      },
    });
  }

  async getUserById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        nome: true,
        email: true,
        role: true,
        clienteId: true,
        unidadeId: true,
        ativo: true,
        createdAt: true,
      },
    });
  }

  async updateUser(id: number, data: UpdateUserDTO) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, clienteId: true, unidadeId: true },
    });

    if (!existing) {
      throw new Error("Usuário não encontrado");
    }

    let nextUnidadeId: number | null | undefined;

    if (data.clienteId !== undefined) {
      nextUnidadeId = await this.resolveUnidadeIdFromCliente(data.clienteId);
    } else if (data.unidadeId !== undefined) {
      nextUnidadeId = data.unidadeId;
    }

    const updateData: Prisma.UserUncheckedUpdateInput = {
      ...(data.nome !== undefined ? { nome: data.nome } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.clienteId !== undefined ? { clienteId: data.clienteId } : {}),
      ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
      ...(nextUnidadeId !== undefined ? { unidadeId: nextUnidadeId } : {}),
    };

    const nextRole = data.role ?? existing.role;
    const effectiveUnidadeId =
      nextUnidadeId !== undefined ? nextUnidadeId : existing.unidadeId;

    if (nextRole === "TECNICO" && effectiveUnidadeId == null) {
      throw new Error(
        "Técnico deve ter unidade vinculada (informe clienteId ou unidadeId)",
      );
    }

    if (
      nextRole === "TECNICO" &&
      data.clienteId !== undefined &&
      data.unidadeId !== undefined &&
      nextUnidadeId !== undefined &&
      data.unidadeId !== nextUnidadeId
    ) {
      throw new Error(
        "unidadeId informado não corresponde à unidade do cliente",
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        nome: true,
        email: true,
        role: true,
        clienteId: true,
        unidadeId: true,
        ativo: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(id: number) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async resetPassword(username: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    return this.prisma.user.update({
      where: { username },
      data: { password: hashedPassword },
      select: {
        id: true,
        username: true,
        nome: true,
        email: true,
        role: true,
        clienteId: true,
        unidadeId: true,
        ativo: true,
        updatedAt: true,
      },
    });
  }

  async changePassword(id: number, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    return this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
      select: {
        id: true,
        username: true,
        nome: true,
        email: true,
        role: true,
        clienteId: true,
        unidadeId: true,
        ativo: true,
        updatedAt: true,
      },
    });
  }
}
