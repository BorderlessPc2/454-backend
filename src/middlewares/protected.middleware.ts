import { authMiddleware } from "./auth.middleware.js";
import { horarioAccessMiddleware } from "./horario-access.middleware.js";

/** Autenticação + restrição de horário para técnicos. */
export const protectedMiddleware = [authMiddleware, horarioAccessMiddleware];
