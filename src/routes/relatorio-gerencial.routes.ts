import { Router } from "express";
import { RelatorioGerencialController } from "../controllers/relatorio-gerencial.controller.js";
import { protectedMiddleware } from "../middlewares/protected.middleware.js";

const router = Router();

router.use(...protectedMiddleware);
router.get("/", RelatorioGerencialController.get);

export default router;
