import { Router } from "express";
import { RelatorioController } from "../controllers/relatorio.controller.js";
import { RelatorioCalendarioController } from "../controllers/relatorio-calendario.controller.js";
import { RelatorioGerencialController } from "../controllers/relatorio-gerencial.controller.js";
import { protectedMiddleware } from "../middlewares/protected.middleware.js";
import { requireNumericIdParam } from "../middlewares/numeric-id.middleware.js";

const router = Router();

router.use(...protectedMiddleware);

// Rotas literais antes de /:id (evita capturar "calendario", "gerencial", etc.)
router.get("/gerencial", RelatorioGerencialController.get);
router.get("/calendario", RelatorioCalendarioController.listCalendario);
router.post("/agendamento", RelatorioCalendarioController.createAgendamento);

router.post("/", RelatorioController.create);
router.get("/", RelatorioController.findAll);

router.get(
  "/:id/pdf-file",
  requireNumericIdParam,
  RelatorioController.downloadPdfFile,
);
router.post(
  "/:id/enviar-email",
  requireNumericIdParam,
  RelatorioController.enviarEmail,
);
router.get(
  "/:id/pdf-layout",
  requireNumericIdParam,
  RelatorioController.getRelatorioParaPdf,
);
router.get(
  "/:id/pdf",
  requireNumericIdParam,
  RelatorioController.getRelatorioParaPdf,
);
router.get(
  "/:id/audit-logs",
  requireNumericIdParam,
  RelatorioController.findAuditLogs,
);
router.patch(
  "/:id/data-visita",
  requireNumericIdParam,
  RelatorioCalendarioController.reagendarDataVisita,
);
router.get("/:id", requireNumericIdParam, RelatorioController.findById);
router.put("/:id", requireNumericIdParam, RelatorioController.update);
router.delete("/:id", requireNumericIdParam, RelatorioController.delete);

export default router;
