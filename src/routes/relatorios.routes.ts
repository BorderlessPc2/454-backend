import { Router } from "express";
import { RelatorioController } from "../controllers/relatorio.controller.js";
import { RelatorioCalendarioController } from "../controllers/relatorio-calendario.controller.js";
import { protectedMiddleware } from "../middlewares/protected.middleware.js";

const router = Router();

router.use(...protectedMiddleware);

router.get("/calendario", RelatorioCalendarioController.listCalendario);
router.post("/agendamento", RelatorioCalendarioController.createAgendamento);
router.patch(
  "/:id/data-visita",
  RelatorioCalendarioController.reagendarDataVisita,
);

router.post("/", RelatorioController.create);
router.get("/", RelatorioController.findAll);
router.get("/:id/pdf-file", RelatorioController.downloadPdfFile);
router.get("/:id/pdf-layout", RelatorioController.getRelatorioParaPdf);
router.get("/:id/pdf", RelatorioController.getRelatorioParaPdf);
router.get("/:id/audit-logs", RelatorioController.findAuditLogs);
router.get("/:id", RelatorioController.findById);
router.put("/:id", RelatorioController.update);
router.delete("/:id", RelatorioController.delete);

export default router;
