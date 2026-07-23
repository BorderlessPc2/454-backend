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

const LOGIN_USER_SELECT = {
  id: true,
  username: true,
  nome: true,
  role: true,
  clienteId: true,
  unidadeId: true,
  password: true,
  ativo: true,
} as const;

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

  private async assertClienteExists(clienteId: number): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true },
    });

    if (!cliente) {
      throw new Error("Cliente não encontrado");
    }
  }

  /**
   * Unidade do usuário é independente do cliente (cliente não tem unidade).
   * `unidadeId` no body permanece opcional/legado.
   */
  private async resolveUnidadeIdOnCreate(
    data: CreateUserDTO,
  ): Promise<number | null> {
    if (data.clienteId !== undefined && data.clienteId !== null) {
      await this.assertClienteExists(data.clienteId);
    }

    if (data.unidadeId !== undefined) {
      return data.unidadeId;
    }

    return null;
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

    const credential = email;

    if (data.password == null || String(data.password).trim() === "") {
      throw new Error("Senha não fornecida");
    }

    const credentialCheckStartedAt = Date.now();
    const loginStartedAt = credentialCheckStartedAt;

    const lookupStartedAt = Date.now();
    const user = credential.includes("@")
      ? await this.prisma.user.findUnique({
          where: { email: credential },
          select: LOGIN_USER_SELECT,
        })
      : await this.prisma.user.findUnique({
          where: { username: credential },
          select: LOGIN_USER_SELECT,
        });
    const lookupMs = Date.now() - lookupStartedAt;

    if (!user || !user.ativo) {
      await delayUntilMinimumElapsed(
        credentialCheckStartedAt,
        CREDENTIAL_FAILURE_MIN_LATENCY_MS,
      );
      console.log(
        "[login-perf]",
        JSON.stringify({
          lookupMs,
          bcryptMs: 0,
          jwtMs: 0,
          totalMs: Date.now() - loginStartedAt,
          success: false,
        }),
      );
      throw new Error("Credenciais inválidas");
    }

    const bcryptStartedAt = Date.now();
    const valid = await bcrypt.compare(String(data.password), user.password);
    const bcryptMs = Date.now() - bcryptStartedAt;

    if (!valid) {
      await delayUntilMinimumElapsed(
        credentialCheckStartedAt,
        CREDENTIAL_FAILURE_MIN_LATENCY_MS,
      );
      console.log(
        "[login-perf]",
        JSON.stringify({
          lookupMs,
          bcryptMs,
          jwtMs: 0,
          totalMs: Date.now() - loginStartedAt,
          success: false,
        }),
      );
      throw new Error("Credenciais inválidas");
    }

    const jwtStartedAt = Date.now();
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
    const jwtMs = Date.now() - jwtStartedAt;

    console.log(
      "[login-perf]",
      JSON.stringify({
        lookupMs,
        bcryptMs,
        jwtMs,
        totalMs: Date.now() - loginStartedAt,
        success: true,
      }),
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

    if (data.clienteId !== undefined && data.clienteId !== null) {
      userData.clienteId = data.clienteId;
    }

    userData.unidadeId = await this.resolveUnidadeIdOnCreate(data);

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
  /**
   * Usuários elegíveis como técnico em relatórios (ADMIN + TECNICO ativos).
   * ADMIN autenticado: sem filtro de unidade. TECNICO: mesma unidade + admins globais (sem unidade).
   */
  async getUsersTecnico(scopedUnidadeId: number | null) {
    const where: Prisma.UserWhereInput = {
      ativo: true,
      role: { in: ["ADMIN", "TECNICO"] },
    };

    if (scopedUnidadeId !== null) {
      where.OR = [
        { unidadeId: scopedUnidadeId },
        { role: "ADMIN", unidadeId: null },
      ];
    }

    return this.prisma.user.findMany({
      where,
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
        updatedAt: true,
        cliente: {
          select: {
            id: true,
            nomeFantasia: true,
          },
        },
      },
      orderBy: { nome: "asc" },
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
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Usuário não encontrado");
    }

    let nextUnidadeId: number | null | undefined;

    if (data.clienteId !== undefined) {
      if (data.clienteId !== null) {
        await this.assertClienteExists(data.clienteId);
      }
      // Cliente não define unidade — limpa a derivada antiga, salvo unidadeId explícito
      nextUnidadeId =
        data.unidadeId !== undefined ? data.unidadeId : null;
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
