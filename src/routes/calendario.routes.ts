import { Router } from "express";
import { CalendarioEventoController } from "../controllers/calendario-evento.controller.js";
import { protectedMiddleware } from "../middlewares/protected.middleware.js";
import { requireNumericIdParam } from "../middlewares/numeric-id.middleware.js";

const router = Router();

router.use(...protectedMiddleware);

router.get("/eventos", CalendarioEventoController.list);
router.post("/eventos", CalendarioEventoController.create);
router.get(
  "/eventos/:id",
  requireNumericIdParam,
  CalendarioEventoController.findById,
);
router.put(
  "/eventos/:id",
  requireNumericIdParam,
  CalendarioEventoController.update,
);
router.delete(
  "/eventos/:id",
  requireNumericIdParam,
  CalendarioEventoController.delete,
);

export default router;
