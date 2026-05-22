import { Router } from "express";
import { ChecklistController } from "../controllers/checklist.controller.js";
import { protectedMiddleware } from "../middlewares/protected.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";

const router = Router();

router.use(...protectedMiddleware);

// GETs liberados para qualquer role autenticado
router.get("/", ChecklistController.findAll);
router.get("/:id", ChecklistController.findById);

router.use(roleMiddleware("ADMIN"));

router.post("/", ChecklistController.create);
router.patch("/ordenacao", ChecklistController.reorder);
router.put("/:id", ChecklistController.update);
router.delete("/:id", ChecklistController.delete);

export default router;
