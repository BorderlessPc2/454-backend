import { Router } from "express";
import { DashboardKpisController } from "../controllers/dashboard-kpis.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { horarioAccessMiddleware } from "../middlewares/horario-access.middleware.js";

const router = Router();

router.get(
  "/kpis",
  authMiddleware,
  horarioAccessMiddleware,
  DashboardKpisController.getKpis,
);

export default router;
