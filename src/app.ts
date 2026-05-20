import express, { type Request, type Response, type NextFunction } from "express";
import path from "path";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { loadOpenApiSpec } from "./docs/loadOpenApi.js";
import authRouter from "./routes/auth.routes.js";
import usersRouter from "./routes/users.routes.js";
import clientesRouter from "./routes/clientes.routes.js";
import relatoriosRouter from "./routes/relatorios.routes.js";
import checklistsRouter from "./routes/checklists.routes.js";
import setoresRouter from "./routes/setores.routes.js";
import ramosRouter from "./routes/ramos.routes.js";
import configuracoesRouter from "./routes/configuracoes.routes.js";
import { prisma } from "./lib/prisma.js";

const app = express();

const corsOriginConfig = process.env["CORS_ORIGIN"] ?? "http://localhost:5173";
const allowedOrigins = corsOriginConfig
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

console.log(`[CORS] Configurado para: ${allowedOrigins.join(", ")}`);
console.log(`[CORS] NODE_ENV: ${process.env["NODE_ENV"] ?? "not-set"}`);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite chamadas server-to-server e health checks sem header Origin
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} não permitida por CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const openApiDocument = loadOpenApiSpec();

app.get("/openapi.json", (_req, res) => {
	res.setHeader("Content-Type", "application/json");
	res.json(openApiDocument);
});

app.use(
	"/api-docs",
	swaggerUi.serve,
	swaggerUi.setup(openApiDocument, {
		explorer: true,
		customCss: ".swagger-ui .topbar { display: none }",
	}),
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/health/db", async (_req, res) => {
	try {
		await prisma.$queryRaw`SELECT 1`;
		res.json({ ok: true, database: true });
	} catch (error) {
		console.error("[health/db]", error);
		res.status(503).json({ ok: false, database: false });
	}
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/clientes", clientesRouter);
app.use("/relatorios", relatoriosRouter);
app.use("/checklists", checklistsRouter);
app.use("/setores", setoresRouter);
app.use("/ramos", ramosRouter);
app.use("/configuracoes", configuracoesRouter);

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message =
    error instanceof Error ? error.message : "Erro interno do servidor";
  const stack = error instanceof Error ? error.stack : undefined;
  console.error("[ERROR]", {
    method: req.method,
    path: req.originalUrl,
    message,
    stack,
  });
  res.status(500).json({ error: message });
});

export default app;
