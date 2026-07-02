import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { ForbiddenError } from "./lib/app-error.js";
import { errorHandler } from "./middlewares/error-handler.middleware.js";
import { loadOpenApiSpec } from "./docs/loadOpenApi.js";
import authRouter from "./routes/auth.routes.js";
import usersRouter from "./routes/users.routes.js";
import clientesRouter from "./routes/clientes.routes.js";
import relatoriosRouter from "./routes/relatorios.routes.js";
import checklistsRouter from "./routes/checklists.routes.js";
import setoresRouter from "./routes/setores.routes.js";
import ramosRouter from "./routes/ramos.routes.js";
import configuracoesRouter from "./routes/configuracoes.routes.js";
import systemActivityRouter from "./routes/system-activity.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import { getUploadsDir } from "./lib/logo-upload.js";
import { prisma } from "./lib/prisma.js";
import { systemLogoFallbackMiddleware } from "./middlewares/system-logo-fallback.middleware.js";

const app = express();
const isProduction = process.env["NODE_ENV"] === "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

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

      callback(new ForbiddenError(`Origin ${origin} não permitida por CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

if (process.env["OPS_REQUEST_LOG"] === "1") {
	app.use((req: Request, res: Response, next: NextFunction) => {
		const started = Date.now();
		res.on("finish", () => {
			try {
				console.log(
					JSON.stringify({
						ts: new Date().toISOString(),
						level: "http",
						method: req.method,
						path: req.originalUrl.split("?")[0] ?? "",
						statusCode: res.statusCode,
						durationMs: Date.now() - started,
					}),
				);
			} catch {
				/* ignore logging errors */
			}
		});
		next();
	});
}

app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  },
  express.static(getUploadsDir()),
  systemLogoFallbackMiddleware,
);

const openApiDocument = loadOpenApiSpec();

if (!isProduction) {
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
}

app.get("/health", (_req: Request, res: Response) => {
	res.json({
		ok: true,
		service: "454-backend",
		uptimeSeconds: Math.floor(process.uptime()),
		timestamp: new Date().toISOString(),
		nodeEnv: process.env["NODE_ENV"] ?? "development",
	});
});

app.get("/health/db", async (_req: Request, res: Response) => {
	try {
		await prisma.$queryRaw`SELECT 1`;
		res.json({ ok: true, database: true, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error("[health/db]", error);
		res.status(503).json({
			ok: false,
			database: false,
			timestamp: new Date().toISOString(),
		});
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
app.use("/admin/activity-logs", systemActivityRouter);
app.use("/dashboard", dashboardRouter);

app.use(errorHandler);

export default app;
