import type { AuthUser } from "../middlewares/auth.middleware.js";

/**
 * ADMIN (ou usuário sem unidade): `null` = sem filtro de unidade (vê tudo).
 * TECNICO com `unidadeId` no token: retorna o id (legado — clientes não têm mais unidade).
 */
export function resolveScopedUnidadeIdForRequest(
	user: AuthUser | undefined,
):
	| { ok: true; scopedUnidadeId: number | null }
	| { ok: false; reason: "no-user" } {
	if (!user) {
		return { ok: false, reason: "no-user" };
	}
	if (user.role === "ADMIN" || user.unidadeId == null) {
		return { ok: true, scopedUnidadeId: null };
	}
	return { ok: true, scopedUnidadeId: user.unidadeId };
}
