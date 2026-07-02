import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { ServiceUnavailableError } from "../lib/app-error.js";
import { configuracaoService } from "../lib/configuracao-service.singleton.js";
import { horarioMiddleware } from "../middlewares/horario.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { horarioAccessMiddleware } from "../middlewares/horario-access.middleware.js";
import { loginRateLimiter } from "../middlewares/login-rate-limit.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { loginSchema, resetPasswordSchema } from "../schemas/auth.schemas.js";

const router = Router();

router.post(
  "/login",
  loginRateLimiter,
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    res.locals["loginRouteStartedAt"] = Date.now();
    try {
      const configStartedAt = Date.now();
      const config = await configuracaoService.get();
      res.locals["loginConfigMs"] = Date.now() - configStartedAt;
      await horarioMiddleware(req, res, next, config);
    } catch (error) {
      console.error("[login] Falha ao verificar horário:", error);
      next(new ServiceUnavailableError());
    }
  },
  AuthController.login,
);

router.get("/me", authMiddleware, horarioAccessMiddleware, AuthController.me);

router.use(authMiddleware);
router.use(roleMiddleware("ADMIN"));
router.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  AuthController.resetPassword,
);

export default router;
