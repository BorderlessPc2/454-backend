import { authMiddleware } from "./auth.middleware.js";
import { horarioAccessMiddleware } from "./horario-access.middleware.js";
import { activityLogMiddleware } from "./activity-log.middleware.js";

/** Autenticação + restrição de horário para técnicos + auditoria de ações. */
export const protectedMiddleware = [
  authMiddleware,
  horarioAccessMiddleware,
  activityLogMiddleware,
];
