import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "../controllers/auth.controller.js";
import { ConfiguracaoService } from "../services/configuracao.service.js";
import { prisma } from "../lib/prisma.js";
import { horarioMiddleware } from "../middlewares/horario.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { horarioAccessMiddleware } from "../middlewares/horario-access.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";

const router = Router();
const configuracaoService = new ConfiguracaoService(prisma);

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas de login. Tente novamente em alguns minutos.",
  },
});

router.post(
  "/login",
  loginRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await configuracaoService.get();
      await horarioMiddleware(req, res, next, config);
    } catch {
      next();
    }
  },
  AuthController.login,
);

router.get("/me", authMiddleware, horarioAccessMiddleware, AuthController.me);

router.use(authMiddleware);
router.use(roleMiddleware("ADMIN"));
router.post("/reset-password", AuthController.resetPassword);

export default router;
