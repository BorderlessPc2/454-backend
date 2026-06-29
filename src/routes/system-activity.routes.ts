import { Router } from "express";
import { SystemActivityController } from "../controllers/system-activity.controller.js";
import { protectedMiddleware } from "../middlewares/protected.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";

const router = Router();

router.use(...protectedMiddleware);
router.use(roleMiddleware("ADMIN"));
router.get("/", SystemActivityController.findAll);

export default router;
