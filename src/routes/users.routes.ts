import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { protectedMiddleware } from "../middlewares/protected.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";

const router = Router();

router.use(...protectedMiddleware);
router.get("/tecnico", AuthController.getUsersTecnico);

// 🔒 Rotas exclusivas para ADMIN
router.use(roleMiddleware("ADMIN"));
router.post("/", AuthController.createUser);
router.get("/", AuthController.getUsers);
router.get("/:id", AuthController.getUserById);
router.put("/:id", AuthController.updateUser);
router.put("/:id/password", AuthController.changePassword);
router.delete("/:id", AuthController.deleteUser);

export default router;
